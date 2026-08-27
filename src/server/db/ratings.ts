import { eq, sql } from "drizzle-orm";

// Relative for the same reason as `schema.ts`: the game server imports this
// too, and it does not resolve the Next path alias.
import {
	TIME_CONTROL_CATEGORIES,
	type TimeControlCategory,
} from "../../lib/timeControls";
import type { db } from "./index";
import {
	DEFAULT_DEVIATION,
	DEFAULT_RATING,
	DEFAULT_VOLATILITY,
	userRatings,
} from "./schema";

/** Accepts the pool or a transaction, so callers can compose their own. */
type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface PoolRating {
	rating: number;
	/** Glicko-2's uncertainty about that rating, and how erratic the results are. */
	deviation: number;
	volatility: number;
	gamesPlayed: number;
	peakRating: number;
	/** False until the pool has actually been played. */
	established: boolean;
}

/** What a pool nobody has played reads as. */
const UNPLAYED: PoolRating = {
	rating: DEFAULT_RATING,
	deviation: DEFAULT_DEVIATION,
	volatility: DEFAULT_VOLATILITY,
	gamesPlayed: 0,
	peakRating: DEFAULT_RATING,
	established: false,
};

export type RatingPools = Record<TimeControlCategory, PoolRating>;

/** What every pool reads as before it has been played. */
export function emptyPools(): RatingPools {
	return Object.fromEntries(
		TIME_CONTROL_CATEGORIES.map((category) => [category, { ...UNPLAYED }]),
	) as RatingPools;
}

/**
 * Every pool for one member, with the unplayed ones filled in.
 *
 * Always returns all four: a caller asking for "their bullet rating" wants
 * the default rather than `undefined` when they have never played a bullet
 * game.
 */
export async function poolsFor(
	executor: Executor,
	userId: string,
): Promise<RatingPools> {
	const rows = await executor
		.select({
			category: userRatings.category,
			rating: userRatings.rating,
			deviation: userRatings.ratingDeviation,
			volatility: userRatings.volatility,
			gamesPlayed: userRatings.gamesPlayed,
			peakRating: userRatings.peakRating,
		})
		.from(userRatings)
		.where(eq(userRatings.userId, userId));

	const pools = emptyPools();
	for (const row of rows) {
		const { category, ...pool } = row;
		pools[category] = { ...pool, established: true };
	}
	return pools;
}

/**
 * Moves one pool by a finished game and counts it.
 *
 * The rating is applied as a delta rather than an absolute: if the same player
 * finished another game in the same pool in between, both still land. Its
 * deviation and volatility cannot work that way — they are not differences,
 * they are the state Glicko-2 hands back — so those are written outright, and
 * the loser of that race is a rating whose uncertainty is one game stale.
 *
 * The insert branch starts from the defaults, which is exactly what a missing
 * row means.
 */
export async function applyPoolDelta(
	executor: Executor,
	userId: string,
	category: TimeControlCategory,
	change: { delta: number; deviation: number; volatility: number },
	playedAt = new Date(),
): Promise<void> {
	const { delta, deviation, volatility } = change;

	await executor
		.insert(userRatings)
		.values({
			userId,
			category,
			rating: DEFAULT_RATING + delta,
			ratingDeviation: deviation,
			volatility,
			gamesPlayed: 1,
			peakRating: Math.max(DEFAULT_RATING, DEFAULT_RATING + delta),
			lastPlayedAt: playedAt,
		})
		.onDuplicateKeyUpdate({
			set: {
				rating: sql`${userRatings.rating} + ${delta}`,
				ratingDeviation: deviation,
				volatility,
				gamesPlayed: sql`${userRatings.gamesPlayed} + 1`,
				peakRating: sql`greatest(${userRatings.peakRating}, ${userRatings.rating} + ${delta})`,
				lastPlayedAt: playedAt,
			},
		});
}
