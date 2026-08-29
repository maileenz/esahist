# Deploying esahist.ro

Four containers, one command. This document is every step of getting them onto a
server and serving the domain — what each image is, how it is built, what it
needs, and how to tell it is working.

```bash
docker compose --env-file .env.docker up -d --build
```

Two of the four images are built from this repository. Two are pulled unchanged.
None of them holds any configuration: everything that differs between your
machine and the server lives in `.env.docker` — with one exception, noted under
**web** below, which is why that image must be rebuilt when the domain changes.

---

## The short way

Every step below is automated in [`scripts/init.sh`](../scripts/init.sh). The
repository is public, so the server can fetch it directly — nothing to copy
across:

```bash
ssh root@YOUR_VPS_IP
curl -fsSL https://raw.githubusercontent.com/maileenz/esahist/main/scripts/init.sh -o init.sh
bash init.sh
```

It installs what is missing, clones the repository into `/home/deploy/esahist`,
asks for the configuration it cannot invent, writes `.env.docker`, and brings all
four containers up. It is resumable: run it, do the one thing it asks for, run it
again.

The rest of this document is the same process by hand.

---

## The four images

| Service | Image | Built from | Listens on | Persists | Size |
| --- | --- | --- | --- | --- | --- |
| `caddy` | `caddy:2-alpine` | pulled | **80, 443** public | `caddy-data`, `caddy-config` | 89 MB |
| `web` | built here | `docker/web.Dockerfile` | 3000, loopback | nothing | 340 MB |
| `game` | built here | `docker/game.Dockerfile` | 2567, loopback | nothing | 1.68 GB |
| `mysql` | `mysql:8.4` | pulled | 3306, loopback | `mysql-data` | 1.12 GB |

Only `caddy` is reachable from the internet. The other three publish their ports
on `127.0.0.1`, so you can reach them from the server itself — for `drizzle-kit`,
for a `mysqldump` — and otherwise they are reachable only by each other, by
service name, over the private network Compose creates.

```
                       the internet
                            |
                      :80   :443
                            |
                 +----------v-----------+
                 |        caddy         |   terminates TLS,
                 |   esahist.ro         |   holds both certificates
                 |   game.esahist.ro    |
                 +---+--------------+---+
                     |              |
          esahist.ro |              | game.esahist.ro
                     |              |
              +------v-----+  +-----v------+
              |    web     |  |    game    |
              |  Next.js   |  |  Colyseus  |
              |   :3000    |  |   :2567    |
              +------+-----+  +-----+------+
                     |              |
                     +------+-------+
                            |
                     +------v------+
                     |    mysql    |   compose network only,
                     |    :3306    |   never public
                     +-------------+
```

One database, shared. The game server authenticates players by reading Auth.js
sessions straight out of it, which is why it is one database and not two.

### web — the Next.js app

Built by [`docker/web.Dockerfile`](../docker/web.Dockerfile) in four stages on
`node:24-alpine`. `deps` installs from the lockfile and its layer is reused until
the lockfile changes; `build` compiles; `runtime` starts from a clean image and
copies in only the standalone bundle, so the toolchain, the dev dependencies and
the source are not in what ships. It runs as the unprivileged `node` user and
answers `/api/health` from memory.

Two things about this image matter before you build it.

**It is domain-specific.** `NEXT_PUBLIC_GAME_SERVER_URL` is inlined into the
browser JavaScript at build time, not read at run time, so it is a build
argument. An image built for one domain cannot be repointed at another by
changing the environment — it has to be rebuilt:

```bash
docker compose --env-file .env.docker up -d --build web
```

**It needs a `DATABASE_URL` at build time, and that one is not a secret.**
`next build` evaluates every route to collect page data, and the Auth.js Drizzle
adapter inspects the database client while it does. The Dockerfile supplies a
placeholder; no connection is opened, and Compose passes the real URL at run
time.

### game — the Colyseus server

Built by [`docker/game.Dockerfile`](../docker/game.Dockerfile), also four stages.
`build:game` typechecks before it bundles, so a room that does not compile fails
the image build rather than the first join. esbuild leaves `node_modules`
external, so unlike the web image this one still needs its dependencies at run
time — it gets a second install from the same lockfile with `--prod`, which is
why it is the largest of the four. It runs as `node`, answers `/health`, and
starts `.game-build/server.mjs`.

Its one operational quirk: **it drains rather than dying.** On `SIGTERM`,
Colyseus waits for every room to dispose so games in progress get their
`onBeforeShutdown` and are persisted. `stop_grace_period` is 90 seconds to allow
for it, so a redeploy during a busy evening is slow, not destructive.

### mysql — the shared database

`mysql:8.4`, unmodified, started with `utf8mb4` explicitly rather than by
default: a flair, a status line or a display name can hold an emoji, and the
older three-byte `utf8` truncates them silently.

Its data lives in the `mysql-data` volume, which is the only state in the stack
that matters. Its health check is `mysqladmin ping --silent` — `--silent` so the
password never lands in the container's log — with a 60-second start period,
because initialising the data directory on first boot takes longer than a
restart and those attempts should not count as failures.

### caddy — the reverse proxy

`caddy:2-alpine` with [`docker/Caddyfile`](../docker/Caddyfile) mounted
read-only. The only container facing the internet. It terminates TLS for both
hostnames, obtains the certificates over ACME and renews them, and forwards to
`web:3000` and `game:2567` over the private network.

It forwards WebSocket upgrades in place and sets `X-Forwarded-For` and
`X-Forwarded-Proto` itself, which is why the Caddyfile contains no configuration
for either. `@colyseus/core` reads the client IP from `x-forwarded-for`, so the
game server sees real addresses rather than the proxy's.

**Keep the `caddy-data` volume.** It holds the certificates and the ACME account
key. Destroy it and every certificate is re-issued from scratch, against a limit
of five per hostname per week.

### migrate — the fifth, which is not part of `up`

A profile-gated service built from `web.Dockerfile`'s `build` stage, because that
is where the source and `drizzle-kit` still exist. It is deliberately outside
`up`: applying schema changes automatically on container start is how a bad
deploy rewrites the database before anyone can stop it.

```bash
docker compose --env-file .env.docker --profile migrate run --rm migrate
```

It runs `pnpm db:push`, which reconciles the database against `schema.ts` and
applies without recording what it did. That is fine against an empty database.
Before real accounts accumulate, move to generated SQL — `pnpm db:generate`
commits reviewable migration files, and this service's command becomes
`pnpm db:migrate`.

---

## 1. Point the domain at the server

Do this first. Certificates cannot be issued until it is done, because Let's
Encrypt proves you own a domain by making a request *to* it.

Confirm the delegation took:

```bash
dig +short NS esahist.ro
```

You want Contabo's nameservers back — copy whatever the panel lists for the zone.
Still seeing datahost's? Either the change has not propagated, which can take up
to 48 hours, or it was not saved.

Then, in the Contabo control panel under DNS Zone Management:

| Type | Name   | Value          | TTL |
| ---- | ------ | -------------- | --- |
| A    | `@`    | your VPS IPv4  | 300 |
| A    | `game` | your VPS IPv4  | 300 |
| A    | `www`  | your VPS IPv4  | 300 |

`@` is the domain itself. Keep the TTL low while setting up, so a mistake costs
five minutes; raise it once the site is stable.

`www` is optional — Caddy redirects it to the bare domain. If you skip the
record, delete the `www` block from `docker/Caddyfile`, or Caddy will keep
failing to get a certificate for a name that does not resolve.

**AAAA records:** add one only if the VPS has IPv6 and the stack is listening on
it. A record pointing at an address nothing answers on is worse than no record,
because browsers try IPv6 first and wait.

```bash
dig +short esahist.ro @1.1.1.1
dig +short game.esahist.ro @1.1.1.1
```

Both must return the VPS address. Asking `1.1.1.1` directly sidesteps whatever
your own resolver cached before the records existed.

---

## 2. Prepare the server

```bash
ssh root@YOUR_VPS_IP
```

A user that is not root:

```bash
adduser deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
```

Confirm `ssh deploy@host` and `sudo` both work before closing the root session.

Firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

**Know what this does and does not do.** Docker writes its own iptables rules
ahead of ufw's, so a port a container *publishes* is reachable whether ufw likes
it or not. What keeps MySQL private is the `127.0.0.1:` prefix in
`docker-compose.yml`, not this firewall. Check the Contabo panel for its own
firewall too — that one sits in front of the machine and will silently drop the
ACME traffic on port 80.

Docker itself:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy
newgrp docker
docker compose version
```

Docker's own installer, not `apt install docker.io` — the distro package lags and
ships no Compose v2, which every command here assumes.

Swap, if `free -h` shows under about 4 GB. Building the web image is the memory
peak of the whole deployment:

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 3. Put the code on the server

The repository is public, so this needs no credentials:

```bash
git clone https://github.com/maileenz/esahist.git esahist
cd esahist
```

It clones what you have pushed — anything uncommitted on your own machine will
not be there, so check before deploying rather than after:

```bash
git status          # should be clean
git push origin main
```

**If you make the repository private**, generate a key on the server, add it
under Settings → Deploy keys with "Allow write access" unchecked, and clone over
SSH instead:

```bash
ssh-keygen -t ed25519 -C "esahist deploy" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
git clone git@github.com:maileenz/esahist.git esahist
```

---

## 4. Configure

```bash
cp .env.docker.example .env.docker
chmod 600 .env.docker
```

That file explains every variable; read it rather than copying values from here.
Generate the secrets on the server — do not invent them, and do not reuse the
development ones:

```bash
openssl rand -base64 32     # AUTH_SECRET
openssl rand -base64 24     # MYSQL_ROOT_PASSWORD
openssl rand -base64 24     # MYSQL_PASSWORD
```

These have to agree with each other and with the DNS records. A mistake here
fails quietly rather than loudly:

| Variable | Value | Read by |
| --- | --- | --- |
| `SITE_DOMAIN` | `esahist.ro` | caddy |
| `GAME_DOMAIN` | `game.esahist.ro` | caddy |
| `ACME_EMAIL` | your address | caddy |
| `AUTH_URL` | `https://esahist.ro` | web |
| `AUTH_COOKIE_DOMAIN` | `.esahist.ro` | web |
| `NEXT_PUBLIC_GAME_SERVER_URL` | `https://game.esahist.ro` | web, **at build time** |
| `ALLOWED_ORIGINS` | `https://esahist.ro` | game |

The domain rule is the one that bites. The game server authenticates a player by
reading the Auth.js session cookie off their join request, and a cookie only
travels to the domain it was issued for plus subdomains of an explicit parent.
Put the game server on an unrelated domain, or forget `AUTH_COOKIE_DOMAIN`, and
nothing errors: every player is seated as an anonymous guest with no name, no
rating, and a game that cannot be saved.

`AUTH_URL` now carries a second job. Besides Auth.js callbacks it is the site's
canonical address: `robots.txt`, `sitemap.xml`, every `<link rel="canonical">`
and the absolute URL of the social card are all built from it. It is also the
switch that decides whether the deployment may be indexed at all — without it,
`robots.txt` serves a blanket `Disallow: /` and every page carries `noindex`.

That is deliberate, and it is what keeps a staging copy from competing with the
real domain in search results. It also means **a production container with no
`AUTH_URL` is invisible to search engines**, silently. If the site stops
appearing in Google, check this variable first.

Also set `ALLOW_ANONYMOUS=false`. And note that the six OAuth values — Discord,
GitHub and Facebook — are **not** optional — `src/env.js` declares them as required strings, so the web container
fails validation and exits if any is blank.

Two things you do not need to do:

- There is no `AUTH_TRUST_HOST`. Setting `AUTH_URL` is enough to make Auth.js
  trust the host the proxy forwards (`@auth/core/lib/utils/env.js`). Sites behind
  a proxy usually find this out through an `UntrustedHost` error at the first
  sign-in attempt.
- There is no certificate to obtain, install or renew by hand.

`.env.docker` is git-ignored and excluded from the build context, so it never
enters an image. Back it up somewhere private anyway: `AUTH_SECRET` signs every
session, and replacing it signs everybody out.

---

## 5. Build the two images that are built

```bash
alias dc='docker compose --env-file .env.docker'
dc build
```

Ten minutes or so the first time; the `deps` layers are cached afterwards, so a
source-only change is much faster. `caddy` and `mysql` are pulled rather than
built, and `dc build` does not touch them.

Confirm what you got:

```bash
docker images | grep esahist
```

---

## 6. Start them, in this order

```bash
dc up -d mysql                          # let the database initialise first
dc --profile migrate run --rm migrate   # create the schema — first boot only
dc up -d                                # web, game and caddy
dc ps
```

All four should reach `healthy` or `running`. `mysql` takes longest on first boot
because it is initialising its data directory.

The order matters only on this first run. `web` and `game` both declare
`depends_on: mysql: condition: service_healthy`, so Compose waits for the
database regardless — but the migration has to happen after it is up and before
the apps start querying it.

---

## 7. Watch the certificates arrive

```bash
dc logs -f caddy
```

Within seconds of `caddy` starting you want `certificate obtained successfully`,
once per hostname. If it retries instead, it is almost always one of three
things: DNS not resolving yet, port 80 blocked by a panel firewall, or a `www`
block in the Caddyfile with no `www` record.

---

## 8. Verify, from the outside in

Run these from your own machine, not the server. Each proves the layer beneath
it, so stop at the first failure.

```bash
# caddy: TLS and routing
curl -I https://esahist.ro

# web
curl -s https://esahist.ro/api/health

# game
curl -s https://game.esahist.ro/health

# game: HTTP matchmaking, with the app's origin
curl -sS -X POST https://game.esahist.ro/matchmake/joinOrCreate/chess -H 'Content-Type: application/json' -H 'Origin: https://esahist.ro' -d '{"timeControl":"blitz","ranked":false}' -i | head -20
```

That last one should return JSON with an `access-control-allow-origin` header
naming your site. An authentication error in the body is the **correct** result
for a request carrying no session cookie — what is being checked is that the
request reached the application at all. An HTML error page or a bare 502 means it
did not.

Then the test that actually matters, and the only one that exercises all four
containers plus the cookie:

1. Open `https://esahist.ro` in two different browsers — not two tabs, and not a
   private window sharing a profile.
2. Sign in as a different account in each.
3. Start a game between them.
4. **Look at the two player bars.** Real usernames, ratings and countries mean
   the session cookie reached the game server on its subdomain. "Guest" in either
   seat means it did not.

---

## 9. Tell the third parties where the site lives

Configured outside this repository, and each silently does nothing until updated:

- **Discord**, OAuth2 redirects: `https://esahist.ro/api/auth/callback/discord`
- **GitHub**, OAuth app callback URL: `https://esahist.ro/api/auth/callback/github`
- **Stripe**, webhook endpoint: `https://esahist.ro/api/stripe/webhook` — put the
  signing secret it returns into `STRIPE_WEBHOOK_SECRET` and restart with
  `dc up -d web`.

---

## Living with it

### Deploying a change

```bash
cd ~/esahist
git pull
dc --profile migrate run --rm migrate   # only if the schema moved
dc up -d --build
```

Compose recreates only the containers whose image or configuration actually
changed. Remember that `NEXT_PUBLIC_GAME_SERVER_URL` is compiled into the web
bundle, so changing it needs `--build`, not merely a restart.

### Backups

The `mysql-data` volume is the only state that matters. Everything else is
rebuildable from the repository.

```bash
dc exec mysql sh -c 'mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines chess' > ~/backup-$(date +%F).sql
```

The password is read inside the container from its own environment rather than
typed, so it stays out of your shell history. `--single-transaction` makes the
dump consistent without locking players out mid-game. Worth a nightly cron entry
writing somewhere that is not this server.

### Looking at it

```bash
dc ps                  # health of all four
dc logs -f game
dc logs -f caddy
dc stats               # what each container is using
```

### Stopping

```bash
dc stop                # keeps the containers and the volumes
dc down                # removes the containers, keeps the volumes
```

Never `dc down -v` on this server unless you mean it. `-v` deletes `mysql-data`
— every account and every game — along with `caddy-data`, which means re-issuing
certificates against a weekly rate limit.

---

## When something is wrong

| Symptom | Cause | Fix |
| --- | --- | --- |
| Players seat as "Guest" | The session cookie never reached `game` | `AUTH_COOKIE_DOMAIN=.esahist.ro`, leading dot included, and `NEXT_PUBLIC_GAME_SERVER_URL` a subdomain of it. Changing the latter needs `dc up -d --build web`. |
| `web` exits at startup | A required variable is blank | The four `AUTH_*` OAuth values are mandatory; `dc logs web` names the one it rejected |
| Caddy never gets a certificate | DNS not resolving, port 80 blocked, or a `www` block with no `www` record | `dig +short esahist.ro @1.1.1.1`; check the panel firewall |
| 502 from Caddy | The container behind it is not healthy | `dc ps`, then `dc logs web` or `dc logs game` |
| Board loads, no move possible | The WebSocket is not getting through, or the origin is refused | `ALLOWED_ORIGINS` must be exactly `https://esahist.ro`; check the browser console for the failed `wss://` |
| Pages 500 on anything with data | The schema was never created | `dc --profile migrate run --rm migrate` |
| `bind: address already in use` on 3306 | Something on the host holds the port | Change `MYSQL_HOST_PORT`; it is a loopback convenience and nothing depends on its value |
| `MODULE_NOT_FOUND: @swc/helpers` in `web` | The `node-linker hoisted` line went missing from `docker/web.Dockerfile` | Restore it; the comment there explains why the standalone build needs it |
| Sign-in fails with `UntrustedHost` | `AUTH_URL` unset, or not matching the browser's address | Set it, scheme included, then `dc up -d web` |
| `mysql` restarts forever | Usually a `MYSQL_ROOT_PASSWORD` changed after the volume was initialised | The volume keeps the original password; restore it, or start over with a fresh volume |
