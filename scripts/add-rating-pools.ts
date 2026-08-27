/**
 * One-off: give every member a rating per time-control pool, and rebuild those
 * pools from the games already played.
 *
 *   npx tsx --env-file=.env scripts/add-rating-pools.ts --dry
 *   npx tsx --env-file=.env scripts/add-rating-pools.ts
 *
 * Creating the table is purely additive and safe to re-run; a fresh install
 * gets it from the schema instead (`npm run db:push`).
 *
 * The rebuild replays every rated, finished game oldest-first and applies Elo
 * into the pool that game belongs to, starting each pool at the default. It
 * also
 * rewrites each game's before-ratings and deltas, because those columns were
 * recorded against the single pool that no longer exists — leaving them would
 * mean a history whose numbers do not add up to the ratings it produced.
 *
 * Re-running recomputes from scratch, so it always lands in the same place.
 */
import { asc, eq, inArray, sql } from "drizzle-orm";
import {
	createPool,
	type ResultSetHeader,
	type RowDataPacket,
} from "mysql2/promise";

import {
	resolveTimeControl,
	TIME_CONTROL_CATEGORIES,
	type TimeControlCategory,
} from "@/lib/timeControls";
import { db } from "@/server/db";
import {
	DEFAULT_DEVIATION,
	DEFAULT_RATING,
	DEFAULT_VOLATILITY,
	games,
	userRatings,
	users,
} from "@/server/db/schema";
import { computeRatingChanges } from "../src/server/colyseus/lib/glicko";

const dry = process.argv.includes("--dry");

/* ------------------------------------------------------------------- table */

if (!dry) {
	const pool = createPool({ uri: process.env.DATABASE_URL });
	const categories = TIME_CONTROL_CATEGORIES.map((c) => `'${c}'`).join(",");

	await pool.query(`
		CREATE TABLE IF NOT EXISTS \`user_rating\` (
			\`user_id\` varchar(255) NOT NULL,
			\`category\` enum(${categories}) NOT NULL,
			\`rating\` smallint NOT NULL DEFAULT ${DEFAULT_RATING},
			\`rating_deviation\` double NOT NULL DEFAULT ${DEFAULT_DEVIATION},
			\`volatility\` double NOT NULL DEFAULT ${DEFAULT_VOLATILITY},
			\`games_played\` int NOT NULL DEFAULT 0,
			\`peak_rating\` smallint NOT NULL DEFAULT ${DEFAULT_RATING},
			\`last_played_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT \`user_rating_user_id_category_pk\`
				PRIMARY KEY (\`user_id\`, \`category\`),
			CONSTRAINT \`user_rating_user_id_user_id_fk\` FOREIGN KEY (\`user_id\`)
				REFERENCES \`user\`(\`id\`) ON DELETE CASCADE
		)
	`);

	/** Columns are checked one at a time so a half-migrated table still lands. */
	async function has(column: string): Promise<boolean> {
		const [rows] = await pool.query<RowDataPacket[]>(
			"SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'user_rating' AND column_name = ?",
			[column],
		);
		return rows.length > 0;
	}

	async function hasUserColumn(column: string): Promise<boolean> {
		const [rows] = await pool.query<RowDataPacket[]>(
			"SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'user' AND column_name = ?",
			[column],
		);
		return rows.length > 0;
	}

	if (!(await has("rating_deviation"))) {
		await pool.query(
			`ALTER TABLE \`user_rating\` ADD COLUMN \`rating_deviation\` double NOT NULL DEFAULT ${DEFAULT_DEVIATION}`,
		);
		console.log("added user_rating.rating_deviation");
	}

	if (!(await has("volatility"))) {
		await pool.query(
			`ALTER TABLE \`user_rating\` ADD COLUMN \`volatility\` double NOT NULL DEFAULT ${DEFAULT_VOLATILITY}`,
		);
		console.log("added user_rating.volatility");
	}

	// `updated_at` became `last_played_at`: same instant, but set deliberately
	// when a pool moves rather than by MySQL on any write. `CHANGE COLUMN`
	// keeps the values that are already in there.
	if ((await has("updated_at")) && !(await has("last_played_at"))) {
		await pool.query(
			"ALTER TABLE `user_rating` CHANGE COLUMN `updated_at` `last_played_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP",
		);
		console.log("renamed user_rating.updated_at to last_played_at");
	} else if (!(await has("last_played_at"))) {
		await pool.query(
			"ALTER TABLE `user_rating` ADD COLUMN `last_played_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP",
		);
		console.log("added user_rating.last_played_at");
	}

	// Categories come and go — `classical` did. Rows in a pool that no longer
	// exists are deleted before the enum is narrowed, or MySQL would refuse the
	// change; the games behind them are re-rated into whatever pool their clock
	// belongs to now.
	const [orphans] = await pool.query<ResultSetHeader>(
		`DELETE FROM \`user_rating\` WHERE \`category\` NOT IN (${categories})`,
	);
	if (orphans.affectedRows > 0) {
		console.log(`removed ${orphans.affectedRows} pools in retired categories`);
	}
	await pool.query(
		`ALTER TABLE \`user_rating\` MODIFY COLUMN \`category\` enum(${categories}) NOT NULL`,
	);

	// `DEFAULT_RATING` is a decision, not a constant of nature: keep the column
	// defaults pointing at whatever it is now. Setting them is idempotent.
	await pool.query(
		`ALTER TABLE \`user_rating\`
			ALTER COLUMN \`rating\` SET DEFAULT ${DEFAULT_RATING},
			ALTER COLUMN \`peak_rating\` SET DEFAULT ${DEFAULT_RATING},
			ALTER COLUMN \`rating_deviation\` SET DEFAULT ${DEFAULT_DEVIATION},
			ALTER COLUMN \`volatility\` SET DEFAULT ${DEFAULT_VOLATILITY}`,
	);
	// The user row used to carry a denormalised headline rating. Every pool a
	// member has is in `user_rating`, so the column was a second copy free to
	// drift — and nothing reads it any more.
	if (await hasUserColumn("rating")) {
		await pool.query("ALTER TABLE `user` DROP COLUMN `rating`");
		console.log("dropped user.rating — ratings live in user_rating");
	}

	await pool.end();
	console.log(`user_rating is in place, starting rating ${DEFAULT_RATING}`);
}

/* ------------------------------------------------------------------ replay */

interface Pool {
	rating: number;
	deviation: number;
	volatility: number;
	gamesPlayed: number;
	peak: number;
	/** When this pool last moved — the tie-break for which one is the headline. */
	lastAt: Date | null;
}

const pools = new Map<string, Map<TimeControlCategory, Pool>>();

/**
 * Pools worth counting, most-played first — the same order `refreshHeadline`
 * applies in SQL, so the headline this writes is the one the app would pick.
 */
function ranked(byCategory: Map<TimeControlCategory, Pool>): Pool[] {
	return [...byCategory.values()]
		.filter((pool) => pool.gamesPlayed > 0)
		.sort(
			(a, b) =>
				b.gamesPlayed - a.gamesPlayed ||
				(b.lastAt?.getTime() ?? 0) - (a.lastAt?.getTime() ?? 0),
		);
}

function poolOf(userId: string, category: TimeControlCategory): Pool {
	let byCategory = pools.get(userId);
	if (!byCategory) {
		byCategory = new Map();
		pools.set(userId, byCategory);
	}
	let pool = byCategory.get(category);
	if (!pool) {
		pool = {
			rating: DEFAULT_RATING,
			deviation: DEFAULT_DEVIATION,
			volatility: DEFAULT_VOLATILITY,
			gamesPlayed: 0,
			peak: DEFAULT_RATING,
			lastAt: null,
		};
		byCategory.set(category, pool);
	}
	return pool;
}

const played = await db
	.select({
		id: games.id,
		timeControl: games.timeControl,
		ranked: games.ranked,
		status: games.status,
		result: games.result,
		whiteUserId: games.whiteUserId,
		blackUserId: games.blackUserId,
		startedAt: games.startedAt,
	})
	.from(games)
	.orderBy(asc(games.startedAt), asc(games.id));

console.log(`replaying ${played.length} games`);

let rated = 0;
const rewrites: {
	id: string;
	whiteBefore: number;
	blackBefore: number;
	whiteDelta: number | null;
	blackDelta: number | null;
	applied: boolean;
}[] = [];

for (const game of played) {
	const { category } = resolveTimeControl(game.timeControl);
	const white = poolOf(game.whiteUserId, category);
	const black = poolOf(game.blackUserId, category);

	const whiteBefore = white.rating;
	const blackBefore = black.rating;

	const scored =
		game.ranked &&
		game.status === "finished" &&
		game.result !== null &&
		game.result !== "*";

	const changes = scored
		? computeRatingChanges(
				{
					userId: game.whiteUserId,
					rating: whiteBefore,
					deviation: white.deviation,
					volatility: white.volatility,
				},
				{
					userId: game.blackUserId,
					rating: blackBefore,
					deviation: black.deviation,
					volatility: black.volatility,
				},
				// `scored` has already ruled out null and "*".
				game.result as "1-0" | "0-1" | "1/2-1/2",
			)
		: null;

	if (changes) {
		rated += 1;
		white.rating = changes[0].after;
		black.rating = changes[1].after;
		white.deviation = changes[0].deviation;
		black.deviation = changes[1].deviation;
		white.volatility = changes[0].volatility;
		black.volatility = changes[1].volatility;
		white.peak = Math.max(white.peak, white.rating);
		black.peak = Math.max(black.peak, black.rating);
		white.gamesPlayed += 1;
		black.gamesPlayed += 1;
		white.lastAt = game.startedAt;
		black.lastAt = game.startedAt;
	}

	rewrites.push({
		id: game.id,
		whiteBefore,
		blackBefore,
		whiteDelta: changes?.[0].delta ?? null,
		blackDelta: changes?.[1].delta ?? null,
		applied: changes !== null,
	});
}

console.log(`${rated} of them were rated`);

/* ------------------------------------------------------------------ report */

const members = await db
	.select({ id: users.id, username: users.username })
	.from(users)
	.where(inArray(users.id, pools.size > 0 ? [...pools.keys()] : [""]));

for (const member of members) {
	const byCategory = pools.get(member.id);
	if (!byCategory) continue;

	const line = TIME_CONTROL_CATEGORIES.map((category) => {
		const pool = byCategory.get(category);
		// A pool only exists once a rated game landed in it; one that saw nothing
		// but casual games is still unplayed as far as ratings go.
		return pool && pool.gamesPlayed > 0
			? `${category} ${pool.rating}±${Math.round(pool.deviation)} (${pool.gamesPlayed})`
			: `${category} —`;
	}).join("  ");

	console.log(`  ${member.username.padEnd(14)} ${line}`);
}

if (dry) {
	console.log("\n--dry: nothing was written");
	process.exit(0);
}

/* ------------------------------------------------------------------- write */

await db.transaction(async (tx) => {
	// The replay covers every game in the table, so what it produced *is* the
	// set of pools that should exist. Clearing first is what makes that true in
	// both directions: a pool whose games have since been deleted goes away
	// instead of sitting there with a rating nothing supports any more.
	await tx.delete(userRatings);

	for (const [userId, byCategory] of pools) {
		for (const [category, pool] of byCategory) {
			// Only pools that were actually played get a row: a missing row is how
			// the rest of the app says "unrated".
			if (pool.gamesPlayed === 0) continue;

			await tx
				.insert(userRatings)
				.values({
					userId,
					category,
					rating: pool.rating,
					ratingDeviation: pool.deviation,
					volatility: pool.volatility,
					gamesPlayed: pool.gamesPlayed,
					peakRating: pool.peak,
					// The real time this pool last moved, not the time of the rebuild:
					// it is what breaks a tie between two pools with the same number
					// of games, here and in `refreshHeadline`.
					lastPlayedAt: pool.lastAt ?? new Date(),
				})
				.onDuplicateKeyUpdate({
					set: {
						rating: pool.rating,
						ratingDeviation: pool.deviation,
						volatility: pool.volatility,
						gamesPlayed: pool.gamesPlayed,
						peakRating: pool.peak,
						lastPlayedAt: pool.lastAt ?? new Date(),
					},
				});
		}

		// `user.gamesPlayed` is the only thing left on the user row that these
		// games decide: the ratings themselves belong to `user_rating`.
		const played = ranked(byCategory);
		if (played.length > 0) {
			await tx
				.update(users)
				.set({
					gamesPlayed: played.reduce((sum, pool) => sum + pool.gamesPlayed, 0),
				})
				.where(eq(users.id, userId));
		}
	}

	// Anybody the replay never saw has no rated games at all, which is not the
	// same as keeping the count their deleted games gave them.
	const rated = new Set(
		[...pools]
			.filter(([, byCategory]) => ranked(byCategory).length > 0)
			.map(([userId]) => userId),
	);

	for (const member of await tx.select({ id: users.id }).from(users)) {
		if (rated.has(member.id)) continue;
		await tx
			.update(users)
			.set({ gamesPlayed: 0 })
			.where(eq(users.id, member.id));
	}

	for (const row of rewrites) {
		await tx
			.update(games)
			.set({
				whiteRatingBefore: row.whiteBefore,
				blackRatingBefore: row.blackBefore,
				whiteRatingDelta: row.whiteDelta,
				blackRatingDelta: row.blackDelta,
				ratingsApplied: row.applied,
			})
			.where(eq(games.id, row.id));
	}
});

// Anyone with no games at all keeps the rating they had and gets no rows,
// which is exactly what "has not played" should look like.
const [{ count } = { count: 0 }] = await db
	.select({ count: sql<number>`count(*)` })
	.from(userRatings);

console.log(`\nwrote ${count} pool rows across ${pools.size} members`);
process.exit(0);
