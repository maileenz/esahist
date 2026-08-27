/**
 * Fill the database with fictitious finished games, so the profiles, the games
 * lists and the replay have something real to work with.
 *
 * Every member plays — the invented opponents it creates and the real accounts
 * that are already there — with `--user` deciding whose profile gets the
 * fullest history.
 *
 *   npx tsx --env-file=.env scripts/seed-games.ts --user=cmargi --count=45
 *   npx tsx --env-file=.env scripts/seed-games.ts --clean
 *
 * The games are played out move by move with the same engine the room uses, so
 * every one of them has a legal move sheet, a PGN, plausible clocks and a real
 * finish — a random FEN would look fine in the list and fall apart in `/game`.
 *
 * Everything it writes is prefixed `seed-`, and `--clean` takes all of it back
 * out again. Re-running replaces the previous seed rather than adding to it,
 * and the same `--seed` always produces the same games.
 */
import { Chess } from "chess.js";
import { like } from "drizzle-orm";

import type { EndReason, GameResult } from "@/lib/protocol";
import {
	TIME_CONTROLS,
	type TimeControl,
	type TimeControlCategory,
} from "@/lib/timeControls";
import { db } from "@/server/db";
import {
	DEFAULT_DEVIATION,
	DEFAULT_RATING,
	DEFAULT_VOLATILITY,
	games,
	gamesHistory,
	users,
} from "@/server/db/schema";
import { computeRatingChanges } from "../src/server/colyseus/lib/glicko";

const GAME_PREFIX = "seed-game-";
const USER_PREFIX = "seed-user-";

/* ------------------------------------------------------------------- input */

const args = new Map<string, string>();
for (const arg of process.argv.slice(2)) {
	const [key, value = "true"] = arg.replace(/^--/, "").split("=");
	if (key) args.set(key, value);
}

const count = Math.min(500, Math.max(1, Number(args.get("count") ?? 45)));
const handle = args.get("user")?.toLowerCase();

/* ---------------------------------------------------------------- fixtures */

/**
 * Invented people. `.invalid` is reserved by RFC 2606, so the addresses can
 * never collide with a real one.
 *
 * Their ratings are offsets from `DEFAULT_RATING` rather than absolutes: the
 * spread is the point, and writing it this way means changing where everybody
 * starts moves the whole field with it.
 */
const OPPONENTS = [
	{ slug: "mira", name: "Mira Petrescu", country: "RO", offset: -38 },
	{ slug: "arvid", name: "Arvid Lindqvist", country: "SE", offset: 88 },
	{ slug: "nadia", name: "Nadia Karimi", country: "IR", offset: -106 },
	{ slug: "tomas", name: "Tomas Rivera", country: "MX", offset: 17 },
	{ slug: "hana", name: "Hana Kobayashi", country: "JP", offset: 133 },
	{ slug: "declan", name: "Declan Byrne", country: "IE", offset: -159 },
	{ slug: "yara", name: "Yara Haddad", country: "LB", offset: 50 },
	{ slug: "piotr", name: "Piotr Zielinski", country: "PL", offset: -24 },
];

/** How often the member named by `--user` jumps the queue for a seat. */
const FOCUS_SHARE = 0.35;

/** A spread across all three pools, including the shortest clocks. */
const CLOCKS: TimeControl[] = [
	TIME_CONTROLS["30s+0"],
	TIME_CONTROLS["20s+1"],
	TIME_CONTROLS["1+0"],
	TIME_CONTROLS["3+0"],
	TIME_CONTROLS["3+2"],
	TIME_CONTROLS["5+0"],
	TIME_CONTROLS["5+3"],
	TIME_CONTROLS["10+0"],
	TIME_CONTROLS["15+10"],
	TIME_CONTROLS["30+0"],
	TIME_CONTROLS["60+0"],
];

/* --------------------------------------------------------------------- rng */

/** Seeded so a given `--seed` always replays the same set of games. */
function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const rng = mulberry32(Number(args.get("seed") ?? 20_260_817));
const pick = <T>(list: readonly T[]): T =>
	list[Math.floor(rng() * list.length)] as T;
const between = (min: number, max: number) => min + rng() * (max - min);
const chance = (probability: number) => rng() < probability;

/* ------------------------------------------------------------------- clean */

if (args.has("clean")) {
	// `game_history` cascades from the game, and everything the invented
	// players own cascades from the user.
	const [removedGames] = await db
		.delete(games)
		.where(like(games.id, `${GAME_PREFIX}%`));
	const [removedUsers] = await db
		.delete(users)
		.where(like(users.id, `${USER_PREFIX}%`));

	console.log(
		`removed ${removedGames.affectedRows} seeded games and ${removedUsers.affectedRows} invented opponents`,
	);
	process.exit(0);
}

/* ------------------------------------------------------------------- field */

const roster = OPPONENTS.map((person) => ({
	...person,
	id: `${USER_PREFIX}${person.slug}`,
	username: person.slug,
	rating: DEFAULT_RATING + person.offset,
}));

for (const person of roster) {
	await db
		.insert(users)
		.values({
			id: person.id,
			username: person.username,
			name: person.name,
			email: `${person.slug}@seed.invalid`,
			country: person.country,
			gamesPlayed: 0,
		})
		.onDuplicateKeyUpdate({
			set: { name: person.name, country: person.country },
		});
}

/**
 * Everybody plays. The field is read back after the invented players are in,
 * so it is every member the database has — a seed that gave the invented ones
 * a history and left the real accounts empty would be testing half the site.
 */
const field = await db
	.select({
		id: users.id,
		username: users.username,
		name: users.name,
	})
	.from(users);

if (field.length < 2) {
	console.error("need at least two members to play each other");
	process.exit(1);
}

const focus = handle
	? field.find((person) => person.username === handle)
	: undefined;

if (handle && !focus) {
	console.error(`no member called "${handle}"`);
	process.exit(1);
}

console.log(
	`seeding ${count} games across ${field.length} members${
		focus ? `, centred on ${focus.username}` : ""
	}`,
);

// A fresh run replaces the last one, so `--count` always means what it says.
await db.delete(games).where(like(games.id, `${GAME_PREFIX}%`));

/* ----------------------------------------------------------------- playing */

interface PlayedMove {
	ply: number;
	color: "w" | "b";
	san: string;
	from: string;
	to: string;
	promotion: string | null;
	fenAfter: string;
	clockMs: number;
	thinkMs: number;
}

/**
 * Plays a whole game out. Moves are random but weighted towards captures and
 * checks, which is enough to keep a move sheet from reading like nonsense, and
 * the clocks are spent as the game goes — a flag is a real flag.
 */
function playOut(clock: TimeControl) {
	const chess = new Chess();
	const log: PlayedMove[] = [];
	const remaining = { w: clock.initialMs, b: clock.initialMs };

	// Long enough to be worth replaying, short enough to stay quick to write.
	const cap = Math.floor(between(18, 96));

	let result: GameResult = "*";
	let reason: EndReason = "resignation";

	while (log.length < cap) {
		const colour = chess.turn();
		const legal = chess.moves({ verbose: true });
		if (legal.length === 0) break;

		const sharp = legal.filter(
			(move) => move.captured || move.san.includes("+"),
		);
		const move = chance(0.45) && sharp.length > 0 ? pick(sharp) : pick(legal);

		// Roughly a sixtieth of the clock per move, with the odd long think.
		const typical = clock.initialMs / 60;
		let think = Math.round(typical * between(0.15, chance(0.08) ? 6 : 2.2));

		if (think >= remaining[colour]) {
			// Out of time before the move was made: this is how a game flags.
			remaining[colour] = 0;
			result = colour === "w" ? "0-1" : "1-0";
			reason = "timeout";
			break;
		}

		think = Math.min(think, Math.round(remaining[colour] * 0.8));
		remaining[colour] = remaining[colour] - think + clock.incrementMs;

		chess.move(move);
		log.push({
			ply: log.length + 1,
			color: colour,
			san: move.san,
			from: move.from,
			to: move.to,
			promotion: move.promotion ?? null,
			fenAfter: chess.fen(),
			clockMs: remaining[colour],
			thinkMs: think,
		});

		if (chess.isGameOver()) break;
	}

	if (reason !== "timeout") {
		if (chess.isCheckmate()) {
			result = chess.turn() === "w" ? "0-1" : "1-0";
			reason = "checkmate";
		} else if (chess.isStalemate()) {
			result = "1/2-1/2";
			reason = "stalemate";
		} else if (chess.isInsufficientMaterial()) {
			result = "1/2-1/2";
			reason = "insufficient_material";
		} else if (chess.isThreefoldRepetition()) {
			result = "1/2-1/2";
			reason = "threefold_repetition";
		} else if (chess.isDrawByFiftyMoves()) {
			result = "1/2-1/2";
			reason = "fifty_move_rule";
		} else {
			// Nobody was mated: somebody gave up, agreed a draw, or walked away.
			const roll = rng();
			if (roll < 0.5) {
				// The player to move resigns.
				result = chess.turn() === "w" ? "0-1" : "1-0";
				reason = "resignation";
			} else if (roll < 0.78) {
				result = "1/2-1/2";
				reason = "agreement";
			} else {
				result = chess.turn() === "w" ? "0-1" : "1-0";
				reason = "abandonment";
			}
		}
	}

	return { chess, log, result, reason };
}

/* ----------------------------------------------------------------- writing */

/**
 * Running ratings, one per member *and pool*: a bullet game and a rapid
 * game do not move the same number, so the before-ratings written onto each
 * row have to be tracked the way the site tracks them.
 *
 * Everybody enters a pool at their nominal rating with a fresh deviation and
 * volatility. Nothing here writes a rating anywhere — `add-rating-pools.ts`
 * derives every pool from the games themselves, so exactly one thing decides
 * them.
 */
/**
 * Where each player enters a pool. Only the invented ones have a nominal
 * rating; everybody else starts where every pool starts, which is also where
 * `add-rating-pools.ts` will replay them from afterwards.
 */
const starting = new Map(roster.map((person) => [person.id, person.rating]));

interface Standing {
	rating: number;
	deviation: number;
	volatility: number;
}

/** One side of a seeded game: whatever the field query returned. */
type Seat = (typeof field)[number];

const pools = new Map<string, Standing>();
const key = (userId: string, category: TimeControlCategory) =>
	`${userId}|${category}`;

/** Where somebody stands in one pool, starting from their nominal rating. */
const standingOf = (userId: string, category: TimeControlCategory): Standing =>
	pools.get(key(userId, category)) ?? {
		rating: starting.get(userId) ?? DEFAULT_RATING,
		deviation: DEFAULT_DEVIATION,
		volatility: DEFAULT_VOLATILITY,
	};

/* ------------------------------------------------------------------ pairing */

const appearances = new Map<string, number>();
const seen = (id: string) => appearances.get(id) ?? 0;

/**
 * Two players for one game.
 *
 * The first seat goes to whoever has played least, which is what spreads the
 * run over the whole field instead of piling it onto whoever the random
 * numbers happen to favour; with `--user` the focus member jumps that queue
 * often enough to come out with a full profile. The opponent is drawn from
 * the four closest ratings in the pool being played, because a seed where a
 * 400 meets a 900 every other game produces a rating history nobody would
 * believe — and Glicko-2 would spend the whole run overreacting to it.
 */
function pickPair(pool: TimeControlCategory): [Seat, Seat] {
	const queue = [...field].sort(
		(a, b) => seen(a.id) - seen(b.id) || rng() - 0.5,
	);

	const first = (focus && chance(FOCUS_SHARE) ? focus : queue[0]) as Seat;
	const others = field.filter((person) => person.id !== first.id);
	const mine = standingOf(first.id, pool).rating;

	const near = [...others]
		.sort(
			(a, b) =>
				Math.abs(standingOf(a.id, pool).rating - mine) -
				Math.abs(standingOf(b.id, pool).rating - mine),
		)
		.slice(0, 4);

	const second = pick(near.length > 0 ? near : others) as Seat;

	appearances.set(first.id, seen(first.id) + 1);
	appearances.set(second.id, seen(second.id) + 1);

	return [first, second];
}

// Oldest first, so the ratings drift in the right direction. The gaps are
// drawn up front and the whole run is placed to end a couple of hours ago —
// walking forward from a guessed start would land the newest games in the
// future, which no amount of ordering can make look right.
const gaps = Array.from(
	{ length: count },
	() => between(4, 30) * 60 * 60 * 1000,
);
const span = gaps.reduce((total, gap) => total + gap, 0);
let when = Date.now() - span - 2 * 60 * 60 * 1000;
const tally = { wins: 0, losses: 0, draws: 0, aborted: 0 };

for (let index = 0; index < count; index += 1) {
	const id = `${GAME_PREFIX}${String(index + 1).padStart(4, "0")}`;
	const clock = pick(CLOCKS);
	const pool = clock.category;

	const [first, second] = pickPair(pool);
	const firstIsWhite = chance(0.5);
	const white = firstIsWhite ? first : second;
	const black = firstIsWhite ? second : first;

	const whiteId = white.id;
	const blackId = black.id;
	const whiteName = white.name ?? white.username;
	const blackName = black.name ?? black.username;
	const whiteStanding = standingOf(whiteId, pool);
	const blackStanding = standingOf(blackId, pool);
	const whiteBefore = whiteStanding.rating;
	const blackBefore = blackStanding.rating;
	const ranked = chance(0.82);

	const startedAt = new Date(when);
	when += gaps[index] ?? 0;

	// One in twenty never really starts — somebody left before the first move.
	const played = chance(0.05) ? null : playOut(clock);

	const result: GameResult = played?.result ?? "*";
	const reason: EndReason = played?.reason ?? "aborted";
	const moves = played?.log.map((move) => move.san) ?? [];

	const spentMs = played
		? played.log.reduce((total, move) => total + move.thinkMs, 0)
		: 20_000;
	const endedAt = new Date(startedAt.getTime() + spentMs + 4000);

	const deltas =
		ranked && played
			? computeRatingChanges(
					{ userId: whiteId, ...whiteStanding },
					{ userId: blackId, ...blackStanding },
					result,
				)
			: null;

	if (deltas) {
		for (const [index, id] of [whiteId, blackId].entries()) {
			const change = deltas[index];
			if (!change) continue;
			pools.set(key(id, pool), {
				rating: change.after,
				deviation: change.deviation,
				volatility: change.volatility,
			});
		}
	}

	if (played) {
		played.chess.setHeader("Event", "Grand Master");
		played.chess.setHeader("Site", "grand-master");
		played.chess.setHeader(
			"Date",
			startedAt.toISOString().slice(0, 10).replace(/-/g, "."),
		);
		played.chess.setHeader("White", whiteName ?? "White");
		played.chess.setHeader("Black", blackName ?? "Black");
		played.chess.setHeader("Result", result);
		played.chess.setHeader("TimeControl", clock.id);
	}

	await db.insert(games).values({
		id,
		roomId: `seed-${String(index + 1).padStart(4, "0")}`,
		timeControl: clock.id,
		initialTimeMs: clock.initialMs,
		incrementMs: clock.incrementMs,
		ranked,
		whiteUserId: whiteId,
		blackUserId: blackId,
		status: played ? "finished" : "aborted",
		result,
		reason,
		winnerColor: result === "1-0" ? "w" : result === "0-1" ? "b" : null,
		moves: moves.join(" ") || null,
		finalFen: played?.chess.fen() ?? null,
		pgn: played?.chess.pgn() ?? null,
		ply: moves.length,
		whiteRatingBefore: whiteBefore,
		blackRatingBefore: blackBefore,
		whiteRatingDelta: deltas?.[0].delta ?? null,
		blackRatingDelta: deltas?.[1].delta ?? null,
		ratingsApplied: deltas !== null,
		startedAt,
		endedAt,
	});

	if (played && played.log.length > 0) {
		// Chunked the way the room writes them: one enormous statement is not
		// worth discovering max_allowed_packet over.
		for (let i = 0; i < played.log.length; i += 100) {
			await db.insert(gamesHistory).values(
				played.log.slice(i, i + 100).map((move) => ({
					gameId: id,
					ply: move.ply,
					color: move.color,
					san: move.san,
					fromSquare: move.from,
					toSquare: move.to,
					promotion: move.promotion,
					fenAfter: move.fenAfter,
					clockMs: move.clockMs,
					thinkMs: move.thinkMs,
					playedAt: new Date(startedAt.getTime() + move.ply * 4000),
				})),
			);
		}
	}

	// The tally is the focus member's record, so only their games count.
	if (focus && (whiteId === focus.id || blackId === focus.id)) {
		const won = whiteId === focus.id ? "1-0" : "0-1";
		if (result === "*") tally.aborted += 1;
		else if (result === "1/2-1/2") tally.draws += 1;
		else if (result === won) tally.wins += 1;
		else tally.losses += 1;
	}
}

if (focus) {
	console.log(
		`${focus.username}: ${tally.wins}W ${tally.losses}L ${tally.draws}D, ${tally.aborted} aborted`,
	);
}

console.log(`${count} games across the field:`);
for (const person of [...field].sort((a, b) => seen(b.id) - seen(a.id))) {
	console.log(`  ${person.username.padEnd(16)} ${seen(person.id)} games`);
}

const idle = field.filter((person) => seen(person.id) === 0);
if (idle.length > 0) {
	console.log(
		`  (${idle.length} nobody was paired with — raise --count above ${field.length})`,
	);
}
console.log(
	"now rebuild the pools: npx tsx --env-file=.env scripts/add-rating-pools.ts",
);
console.log("undo with: npx tsx --env-file=.env scripts/seed-games.ts --clean");
process.exit(0);
