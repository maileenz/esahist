import { Glicko2, newProcedure, type Player } from "glicko2.ts";

import type { GameResult } from "../../../lib/protocol";
// The starting values live with the columns that default to them, so the
// database and the algorithm cannot disagree about what an unplayed pool is.
import {
	DEFAULT_DEVIATION,
	DEFAULT_RATING,
	DEFAULT_VOLATILITY,
} from "../../db/schema";

const RATING_BUCKET_SIZE = 200;

/**
 * The system constant: how much volatility is allowed to move between periods.
 * Glickman suggests 0.3–1.2, smaller for a population with steadier results.
 */
const TAU = 0.5;

/**
 * Rooms are filtered by bucket so a 900 never gets paired with a 2400.
 * The client widens its search across neighbouring buckets before creating a
 * room of its own — see `matchmake()` in the frontend, which mirrors this.
 */
export function ratingBucketOf(rating: number): number {
	const clamped = Math.max(400, Math.min(3200, Math.round(rating)));
	return Math.floor(clamped / RATING_BUCKET_SIZE);
}

/** A configured Glicko-2 system. Cheap: it holds nothing between calls. */
function glicko() {
	return new Glicko2({
		tau: TAU,
		rating: DEFAULT_RATING,
		rd: DEFAULT_DEVIATION,
		vol: DEFAULT_VOLATILITY,
		// The package types this as required rather than optional; passing the
		// default explicitly is both what it wants and a note of which of the two
		// published volatility procedures we are on.
		volatilityAlgorithm: newProcedure,
	});
}

export interface RatedPlayer {
	userId: string;
	rating: number;
	/** RD: how uncertain that rating is. */
	deviation: number;
	volatility: number;
}

export interface RatingDelta {
	userId: string;
	before: number;
	after: number;
	delta: number;
	/** The new RD and volatility, which are replaced rather than added to. */
	deviation: number;
	volatility: number;
}

/**
 * What one game does to two ratings.
 *
 * Glicko-2 is defined over *rating periods* — a batch of games rated together
 * — and this treats every game as a period of its own, which is what every
 * site running live ratings does. The cost is that the paper's inactivity step
 * never runs, so a rating deviation only ever narrows here: somebody who stops
 * playing for a year comes back as certain as they left. Widening idle RDs is a
 * scheduled job, not something a finished game can do.
 *
 * `result` is from White's point of view, matching the PGN token. Returns
 * `null` for unrated outcomes (aborted games, `"*"`).
 */
export function computeRatingChanges(
	white: RatedPlayer,
	black: RatedPlayer,
	result: GameResult,
): [RatingDelta, RatingDelta] | null {
	const whiteScore =
		result === "1-0"
			? 1
			: result === "0-1"
				? 0
				: result === "1/2-1/2"
					? 0.5
					: null;
	if (whiteScore === null) return null;

	const system = glicko();
	const first = system.makePlayer(
		white.rating,
		white.deviation,
		white.volatility,
	);
	const second = system.makePlayer(
		black.rating,
		black.deviation,
		black.volatility,
	);

	system.updateRatings([[first, second, whiteScore]]);

	return [settle(white, first), settle(black, second)];
}

/**
 * The rating is rounded to a whole number because that is what the column and
 * the player both see; RD and volatility keep their decimals, because they are
 * inputs to the next game rather than anything anybody reads.
 */
function settle(before: RatedPlayer, after: Player): RatingDelta {
	const rating = Math.round(after.getRating());

	return {
		userId: before.userId,
		before: before.rating,
		after: rating,
		delta: rating - before.rating,
		deviation: round(after.getRd(), 2),
		volatility: round(after.getVol(), 6),
	};
}

function round(value: number, places: number): number {
	const scale = 10 ** places;
	return Math.round(value * scale) / scale;
}
