# Chess — one Next.js project, two processes

Authoritative Colyseus chess room living inside your Next.js app. No second repo, no webhooks, no second token format: the game server reads the same MySQL database and validates the same Auth.js session your app already issued.

Every dependency is on its latest release. Verified against `colyseus@0.17.10`, `@colyseus/schema@4.x`, `@colyseus/sdk@0.17.x`, `chess.js@1.4.0`, `next-auth@5.0.0-beta.31`, `drizzle-orm` + `mysql2`. Both tsconfigs typecheck clean and the room suite passes 14/14 (`npm test`).

## Yes, one project — with a caveat

Everything above lives in your Next app and shares `src/server/db`, `src/lib/protocol.ts`, `src/lib/timeControls.ts` and one `.env`. What you **cannot** share is the runtime: Colyseus holds long-lived WebSocket connections and in-memory room state, so it needs a normal always-on Node process. It will not run on Vercel functions, and it must not be started from a route handler or `instrumentation.ts` — Next may run several workers, and two workers means two rooms with the same id.

So: one repo, one `package.json`, two processes.

`dev`, `build` and `start` each run both halves through `concurrently`, so the usual three commands do the whole thing:

```bash
npm run dev      # next dev :3000  +  tsx watch on the room  :2567
npm run build    # next build      +  esbuild bundle
npm run start    # next start      +  node .game-build/server.mjs
```

Each half is also addressable on its own — `dev:next`, `dev:game`, `build:game`, `start:game`, `typecheck:next`, `typecheck:game` — which is what you want when deploying them to different places. `dev` and `start` use `--kill-others` so one crash takes the pair down instead of leaving a half-dead stack; `build` uses `--kill-others-on-fail` so a failing typecheck stops the Next build too.

Deploying is still two targets: `next build` → Vercel (or wherever), and `build:game` + `start:game` → Railway / Fly / Render / a VM.

`build:game` typechecks with the game server's own tsconfig, then bundles to a single ESM file with esbuild. It is a bundle rather than a `tsc` emit because **Colyseus 0.17 and `cookie` 2 are ESM-only** — a CommonJS build would compile happily and then die on `require()` at boot. esbuild with `--format=esm --packages=external` sidesteps that, and bundling the local files means no `.js` extension churn across the shared `src/server/db` code that Next also imports.

The room schema needs `experimentalDecorators`, which is why `src/server/colyseus` has its own tsconfig, the Next one excludes that directory, and **all three tools are pointed at it explicitly**: `--tsconfig` on both the `tsx watch` in `dev:game` and the esbuild call in `build:game`, and `-p` for `typecheck:game`. tsx otherwise picks the tsconfig next to the working directory, compiles the schema with standard ES decorators, and the process dies at boot on `Cannot read properties of undefined (reading 'constructor')`.

`@/*` resolves to `./src/*` for the Next app only. The game server uses relative imports and must keep doing so — including through `src/server/db`, which both halves import: one `@/env` in there is enough to break `npm test`, `typecheck:game` and `build:game` at once. `DATABASE_URL` is still validated for Next, because `next.config.js` imports `src/env.js`.

## Setup

```bash
cp .env.example .env           # DATABASE_URL, AUTH_SECRET, AUTH_DISCORD_*, NEXT_PUBLIC_GAME_SERVER_URL
npm install
npm run db:generate && npm run db:migrate
npm run dev                    # next :3000  +  colyseus :2567
```

`src/env.js` and `.env.example` list the same variables, so a missing one fails the build with a readable error rather than at runtime. The Colyseus-only settings (`GAME_PORT`, `ALLOWED_ORIGINS`, `ALLOW_ANONYMOUS`, `MONITOR_*`) are declared there for completeness but read from `process.env` in the game process — `@t3-oss/env-nextjs` is a Next-side module and the game server cannot import it.

Two version notes. TypeScript is pinned to 5.x: 7.x is the native rewrite and the Next plugin, `drizzle-kit` and the decorator handling are not settled on it yet. `next-auth` stays on `5.0.0-beta.31` as you have it — `beta.32` is out, and moving is a one-line change once you have tested it.

`package.json` pins `@auth/core` through `overrides`: `next-auth@5.0.0-beta.31` depends on an exact version, and letting the Drizzle adapter resolve a second copy makes the two `Adapter` types structurally incompatible.

`src/server/db/schema.ts` already contains the four Auth.js tables the Drizzle adapter expects, extended with `rating`, `games_played` and `banned_at` on `users`, plus `user_rating` for the per-pool ratings. If you already have those tables, generate the migration and check the diff before applying — only the added columns and the new tables should appear. An existing database can take the rating pools with `npx tsx --env-file=.env scripts/add-rating-pools.ts`, which creates the table and rebuilds every pool from the games already played.

## How authentication works

There is no token endpoint and no token handling in the client. The SDK sends matchmaking requests with `credentials: "include"`, so the browser attaches the `authjs.session-token` cookie by itself. `static onAuth` reads it off `context.headers`, joins `sessions` → `users` on the primary key, and checks `expires > now()` and `banned_at is null`.

The cookie stays httpOnly the whole way — JavaScript never sees it, so an XSS cannot lift a session out of your app. And because nothing is cached, signing out or setting `banned_at` takes effect on the next join attempt. `onAuth` runs before a seat is reserved, so a bad session never reaches `onJoin`.

Everything the room trusts comes from that lookup. Join options only carry preferences — including `ratingBucket`, which `onJoin` re-derives from the database rating for the room's own pool and rejects if it is off by more than `MAX_BUCKET_SPREAD` bands. The `ratings` prop the page passes to `<PlayShell>` is a hint for bucket selection, nothing more.

Sign-in itself is a custom page at `/login`, registered as `pages.signIn`, so `/api/auth/signin` and every unauthenticated redirect land there instead of the stock Auth.js screen. Discord and GitHub are both wired up; adding another is a provider in `authConfig`, its `AUTH_<PROVIDER>_ID` / `_SECRET` pair, and a button. What you cannot add is an email-and-password form: Auth.js Credentials requires `strategy: "jwt"`, and the `sessions` rows this whole design authenticates against would stop existing.

**The cookie has to be in scope for the game server's origin**, which is the one real constraint:

- **Locally**, nothing to do: cookies ignore the port, so `localhost:3000` and `localhost:2567` already share them.
- **In production**, run the game server on a subdomain (`game.example.com`) and set `AUTH_COOKIE_DOMAIN=.example.com` so Auth.js issues the cookie for the parent domain. `__Secure-` allows a `Domain` attribute; `__Host-` would not, which is why the config names the cookie explicitly.
- `sameSite: "lax"` is deliberate and sufficient — a different subdomain is same-site, so the cookie is sent, while a genuine cross-site page still cannot use it. Do not switch to `sameSite: "none"`; that would let any site trigger authenticated matchmaking in a signed-in user's browser.
- `ALLOWED_ORIGINS` must list your app origin exactly. CORS with credentials rejects `*`, and the allowlist is what stops other origins reading the response.

If you ever have to host the game server on an unrelated domain (a `*.up.railway.app` URL, say), cookies cannot span registrable domains — put it behind a CNAME on your own subdomain, or fall back to handing the client a short-lived credential from a route handler.

## The lobby

`/` is one route: a board on the left and a panel on the right, the way you would expect a chess site to look. The board is always there — `IdleBoard` shows the starting position with empty seats until you are actually playing — and only the right column changes. `PlayShell` keeps the connection hook mounted across all of it, so the socket and the reconnection token survive the trip back to the lobby.

The right column is the **New Game** panel (`GameSetup`) while idle: a summary row that collapses the picker, a Rated switch, and clocks grouped Bullet / Blitz / Rapid / Classical. Only the first three of each category are shown — `FEATURED_PER_CATEGORY` — with the rest behind "More time controls"; a `?tc=` selection outside that set expands it on load, since a selection you cannot see is worse than a longer list. Then **Start Game** puts you in the queue, with a Cancel that frees the seat so the empty room disposes itself. Nothing auto-joins.

The panel writes exactly two join options: a time control from the `TIME_CONTROLS` whitelist and rated or casual. The summary row shows your rating in the pool that clock belongs to, so it changes as you pick — a `?` after it means the pool is unplayed and 1500 is a placeholder. The rating band is not a user setting — `matchmake()` widens by one bucket on its own, and the room verifies the claim against the database rating.

## Members and replays

`/member/<username>` is a player's profile. The **layout** owns everything above the tabs — avatar, flag, a card per rating pool, and a W/D/L record with a tournament-style score — and resolves the member once, 404ing there so no child route has to. The tabs are sibling routes rather than client state, so each is linkable and fetches only its own data:

| route | shows |
| --- | --- |
| `/member/<username>` | game history, `?page=` |
| `/member/<username>/friends` | friends, plus your own inbox and outbox |
| `/member/<username>/favourites` | saved games, `?page=` — your profile only, 404 elsewhere |

Each page **prefetches on the server and hydrates**: `void api.x.prefetch(input)` puts the promise in the query cache, `<HydrateClient>` serialises it into the tree, and the client component reads it with `useSuspenseQuery` — no second request, no loading branch, and `data` is non-nullable so there is no `?? []` anywhere.

Three things follow from that:

- The query key is built from the input, so a page's `prefetch` and its component's `useSuspenseQuery` must pass *identical* objects. That is why the username is lowercased before either sees it, and why paging lives in `?page=` rather than component state — the server can only prefetch a page the URL tells it about.
- `useSuspenseQuery` has no `enabled`. "Don't fetch the inbox on someone else's profile" therefore has to mean "don't render that component", which is why `FriendsPanel` splits the session-scoped part out instead of disabling a query.
- It has no error flag either — a failure throws. Each panel sits in a `<Suspense>` with a skeleton, and `member/[username]/error.tsx` catches the throw so one bad tab does not take the header down with it.

Every row opens `/game/<id>`, which replays the game — step with the buttons or the arrow keys, jump by clicking a move, flip the board, and see each player's clock as it stood at that ply. All of it requires a session and redirects to `/login` with a `callbackUrl` when there isn't one.

The replay reads `game_history.fen_after`, so stepping is an index into a list rather than a re-simulation. Games stored before that table was filled still work: with no history rows the viewer reconstructs positions from the SAN in `games.moves` with chess.js.

`user.username` is the URL identity — unique, lowercase, `[a-z0-9-]`. It is derived at sign-in from the provider handle (Discord `username`, GitHub `login`), slugified, with `-2`, `-3`… appended if taken. Both providers keep their own `profile()` mapping and only gain this one field, so avatar rules stay Auth.js's problem. The column also carries a random `$defaultFn` default: two people claiming the same handle in the same instant would otherwise turn a unique-index collision into a failed sign-in.

### Favourites

The heart on any game row or replay saves it to `game_favourite`, and your own profile gains a **♥ Favourites** tab beside **Games** and **Friends**. Saved games are **private**: every query in the router is scoped to `ctx.session.user.id`, so there is no argument you can pass to read someone else's list, and the star you see on another member's history is *your* bookmark of their game, not theirs.

A favourite does not have to be a game you played — you can save any game you can open — so `color`, `opponent` and `delta` come back null for those, and the row renders as "White vs Black" instead of "you vs them".

### Country

`user.country` is a nullable ISO 3166-1 alpha-2 code, shown as a flag on profiles and in friends lists.

**No provider reports a country.** Discord's OAuth user object has `locale`, which is a *language* setting — useful only when it carries a region subtag (`pt-BR` → BR, `en-US` → US), and plenty of people outside the US run `en-US`. GitHub has `location`, which is free text the member typed ("Mars", "127.0.0.1", empty). So the column is filled best-effort at sign-in and the member owns it after that:

1. a platform GeoIP header if one is present — `x-vercel-ip-country`, `cf-ipcountry`, `x-geo-country`, `fastly-client-country-code` (nothing sets these locally, and Cloudflare's `XX` for anonymised clients is ignored);
2. otherwise Discord's locale region, when it has one;
3. otherwise nothing — and the picker on your own profile is the authoritative source either way.

Only the codes are stored. Names come from `Intl.DisplayNames`, and flags are SVGs from [`flag-icons`](https://github.com/lipis/flag-icons), rendered by `<Flag>`. **Not** regional-indicator emoji: Windows ships no flag glyphs in Segoe UI Emoji, so 🇷🇴 renders there as the letters "RO".

Its stylesheet is imported in `app/layout.tsx` rather than through `globals.css`, because Tailwind v4 inlines `@import` itself and would rebase the package's `url(../flags/…)` references against `src/styles/`, breaking every flag. Each flag is a background image, so only the ones actually on screen are fetched.

### Friends

Open a profile and **Add friend**; the other member sees a badge in the header, and Accept / Decline on their own profile. The button renders from `friend.status`, so it always shows the stored state — Add friend, "Request sent — cancel", Accept/Decline, or ✓ Friends.

One row per relationship, kept in the direction it was asked in, because a request has a sender and a receiver. Two consequences worth knowing:

- **A reciprocal request is an acceptance.** If B asks A while A→B is already pending, that does not open a second, mirror-image row — the existing one is accepted and both sides are friends.
- **Declining deletes the row** rather than storing a `declined` state, so the pair is back to having no relationship and either side may ask again.

Friends lists are visible to any signed-in member, since a social graph is not a secret. Your **inbox and outbox are not**: `friend.pending` and `friend.pendingCount` read `ctx.session.user.id` and take no arguments, so there is nothing to pass to read someone else's.

### Blocking

**Block** sits beside the friend button and takes a second click to confirm, because it is not reversible in the way it looks: blocking deletes any friendship or pending request between the two, and unblocking does not bring it back. `user_block` is its own table — directional, unlike friendship, and possible between two people who have no relationship at all.

A block is enforced in three places, not just the profile:

- `friend.request` refuses in **both** directions while a block exists.
- `friend.status` reports `blocked` to the person who blocked, and plain `none` to the person who was blocked — with `request` failing on a message ("This member is not accepting friend requests") that does not say which of the two it is. **Nobody is told they have been blocked.**
- `ChessRoom.onJoin` checks `areBlocked` before taking a seat, so the two are never matched against each other. That lookup **fails open**, unlike `authenticate`: a database hiccup that stopped every game from starting would be worse than one unwanted pairing, and there is no security boundary here.

Refusing a seat leaves the waiting player untouched, and `matchmake()` treats a refusal like an empty bucket — it widens, then falls back to `client.create` so a block can never leave somebody unable to start a game.

Your block list is on your own Friends tab. Nobody else can read it: `friend.blocked` takes no arguments.

### Reporting

**Report** sits beside Block on a profile and opens a dialog of eleven reasons grouped under Abuse / Fair Play / Other, with an optional "Block them too" in the footer and a submit button that stays disabled until a reason is chosen. The reasons live in `src/lib/reportReasons.ts` — the dialog renders from that list and the router validates against it, so adding one is a single entry.

`user_report` is a queue, not a relationship: many rows per pair, with a surrogate key and a `status` of `open` / `reviewed` / `dismissed`. **One open report per pair** — filing again while the first is still queued returns `alreadyReported` instead of inserting, since a second identical row tells a moderator nothing and is the obvious way to spam. Once a moderator moves the first out of `open`, the same reporter can file again.

Reporting and blocking in one submit go through the same `blockMember()` helper the Block button uses, so "blocked" means one thing whichever door it came through.

### Moderation

`user.role` is `member` or `admin`, and **only a script can grant it** — `npx tsx --env-file=.env scripts/set-role.ts <username> admin`. There is no endpoint that hands out roles, so a compromised session cannot promote itself.

Admins get `/admin`: the report queue, filtered by Open / Reviewed / Dismissed, each row linking to both profiles with **Mark reviewed**, **Dismiss** and **Suspend**. A shield in the header shows the open count.

- Every procedure is an `adminProcedure`, so the role check lives in one middleware rather than being repeated per handler. The page checks too, but that is presentation — the API is the gate.
- `/admin` returns **404, not 403**, for members. There is no reason to tell someone the route exists.
- The role is read from the session, which is safe here only because sessions are database-backed: `auth()` re-reads the user row on every request, so a demotion takes effect on the next page load rather than lasting until a token expires. It also means `set-role.ts` needs a reload, not a re-login.
- **Suspending sets `banned_at`**, which is exactly what the game server already checks in `onAuth` — so a suspended member is refused the next time they try to join a room. It does not end a game in progress. Admins cannot be suspended from here; locking each other out is not a workflow anybody wants.

**Upgrading an existing database**: a `NOT NULL UNIQUE` column cannot be added to populated rows in one statement, so run `npx tsx --env-file=.env scripts/add-usernames.ts` once. It adds the column nullable, fills it from each user's name or email, then tightens it and adds the index. Then `scripts/add-favourites.ts`, `scripts/add-friendships.ts`, `scripts/add-blocks.ts` and `scripts/add-reports.ts` create the social tables, and `scripts/add-country.ts` and `scripts/add-roles.ts` add the country and role columns. All are additive and safe to re-run; a fresh install gets everything from `npm run db:push` instead.

## Theming

Two independent axes, both set from one **Appearance** dialog — the gear in the header, or the row at the bottom of the New Game panel. It is a native `<dialog>` opened with `showModal()`, so Esc, the backdrop and the top layer are the browser's job rather than ours; changes apply live, with a small preview board underneath.

**Site palette** — Light, Dark, Midnight, Parchment — is `next-themes` with `attribute="class"`, so the class lands on `<html>` before paint and nothing flashes. **Board palette** — six sets of squares — is a second, smaller provider in the same file writing `data-board`.

It has to be a second provider: nesting two `ThemeProvider`s does not work, because next-themes deliberately ignores a nested instance (`if (context) return children`) and the inner one silently does nothing. The board provider follows the same recipe — a blocking inline script that settles the attribute during HTML parse, then React state for the picker.

Components never name a colour. They use semantic utilities — `bg-surface`, `border-line`, `text-muted`, `bg-accent` — that resolve to CSS variables, and each theme is one block in `src/styles/globals.css` redefining those variables. **Adding a site theme is that block plus one entry in `src/lib/themes.ts`**; no component changes. The `dark:` variant is remapped to the class (`@custom-variant`) so it can never disagree with the picker.

Confirmation dialogs (`src/lib/sweet-alert.ts`) follow the same tokens through SweetAlert2's `customClass`. They carry `!` important modifiers, which is not decoration: SweetAlert2 injects its own stylesheet at runtime, usually after ours, so a plain `bg-surface` loses to `.swal2-popup` and every dialog would come out white in Midnight.

Board palettes live in `src/lib/themes.ts` alone: the provider turns them into `[data-board="…"]` rules, the squares read `var(--board-light)` / `var(--board-dark)`, and the swatches in the picker read the same constants — so a swatch cannot lie about the board it selects.

## Ratings

There is one rating per time-control category — bullet, blitz, rapid, classical — because a one-minute game and a thirty-minute game are not measuring the same thing. They live in `user_rating`, keyed by member and pool, with the pool's peak and the time it last moved. **A missing row means unrated**: it reads as a provisional 1500 and is written by the first rated game in that pool, so somebody who only plays blitz is not carrying three numbers they never earned.

`user.rating` stays on the user row as the *headline* — it mirrors whichever pool has been played most, ties going to the one played most recently. That is what every list showing a single number reads (friends, search, the block list, moderation), so those queries stay single-table, and a bullet specialist is never introduced by a classical rating they touched twice. `src/server/db/ratings.ts` owns all of it: `poolsFor`, `applyPoolDelta` and `refreshHeadline`.

The room narrows a player to one pool the moment they are seated (`auth.ratings[category]`), so the bucket check, the seat, the stored before-rating and the Elo maths all read the rating actually at stake without knowing pools exist. `kFactor` then sees that pool's game count, which is what makes a first rapid game provisional for someone with two hundred blitz games behind them. When the store applies the result it reads the pool back off the game row rather than being told, so a retry can never land a blitz result in the rapid pool.

`scripts/add-rating-pools.ts` rebuilds every pool by replaying the game history oldest-first, and rewrites each game's before-ratings and deltas to match. Re-running recomputes from scratch, so it always lands in the same place.

## Matchmaking

`defineRoom(ChessRoom).filterBy(["timeControl", "ranked", "ratingBucket"])` turns one room type into a queue per clock and rating band — a `join` only lands in a room whose creation options match exactly. `.sortBy({ clients: -1 })` prefers rooms that already have someone waiting, and `maxClients = 2` auto-locks a full room.

Exact matching alone would strand a 1550 and a 1610 in separate rooms, so `matchmake()` tries `join` in its own bucket, then the neighbours, and only calls `joinOrCreate` when nothing is waiting. `spread` defaults to one bucket either side; raising it means raising `MAX_BUCKET_SPREAD` in `ChessRoom` to match, or ranked joins come back as `rating_bucket_mismatch`.

## What the room enforces

- Every move is validated by chess.js **on the server**. The client's optimistic move is display only; a rejection ships the authoritative FEN back and the board snaps to it.
- Move payloads are Zod-validated before the handler runs; `maxMessagesPerSecond = 20` disconnects flooders; one user id per room, so nobody farms rating against themselves.
- Clocks: `consumeClock()` charges the mover both on a 200ms tick and immediately before validating a move, so a move arriving after the flag falls is scored as a timeout. Increment is credited after the move lands. Flag against a bare king or single minor is a draw, per FIDE.
- Draws by stalemate, insufficient material, threefold, fifty-move (read off the FEN halfmove clock) and agreement.
- `onDrop` holds the seat for 60s with the clock running; the SDK reconnects a dropped socket automatically and a full page refresh is covered by the reconnection token in `sessionStorage`. Past that window the absent player forfeits — unless fewer than two plies were played, in which case the game aborts unrated.

## What lands in the database

`games` gets a row when both seats fill (`status: "playing"`), so in-progress games are queryable, and is upserted at the end with result, reason, PGN, SAN list, final FEN and the rating deltas. `games_history` gets one row per half-move with SAN, from/to, resulting FEN, clock remaining and think time — enough for a move-by-move replay with clocks, or an opening explorer. Drop that table if the PGN is enough for you; `src/server/colyseus/lib/store.ts` is the only file that touches it.

Elo is applied in a transaction guarded by `games.ratings_applied`, selected `FOR UPDATE`, and written as `rating = rating + delta` so a player finishing two games at once gets both. Retried saves are no-ops.

Without `DATABASE_URL` the store falls back to logging — that is what lets the test suite (14 tests) run with `ALLOW_ANONYMOUS=true` and no database at all. Note that a failed session lookup fails closed: a database outage reads as "not authenticated", never as a guest.

## Scaling

One process is fine well past a thousand concurrent games. Beyond that, add `presence: new RedisPresence()` and `driver: new RedisDriver()` in `app.config.ts` and put sticky sessions in front — a socket must stay on the process that owns its room. Give the container a stop timeout above your drain time; Colyseus waits for rooms to dispose on SIGTERM, and `onBeforeShutdown` persists live games unrated.

The cookie header is parsed with the `cookie` package — the same parser Next.js and Auth.js use, so quoting and percent-decoding round-trip exactly. In v2 that export is `parseCookie`, not `parse`.

Set `MONITOR_PASSWORD` to mount `/monitor`; leave it empty and the route is never registered. The playground is dev-only.

## Not included

Premoves, takebacks, spectators, engine-cheat detection, Glicko-2, tournaments. Each is additive: takebacks mirror the draw-offer request/approve pair, spectators want a larger `maxClients` plus a `StateView` so they never receive a player's private fields.
