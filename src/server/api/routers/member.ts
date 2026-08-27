import { and, asc, desc, eq, isNotNull, lt, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { z } from "zod";

import { outcomeFor } from "@/lib/gameResult";
import {
	resolveTimeControl,
	TIME_CONTROL_CATEGORIES,
	type TimeControlCategory,
} from "@/lib/timeControls";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { poolsFor } from "@/server/db/ratings";
import { DEFAULT_RATING, games, gamesHistory, users } from "@/server/db/schema";

const PAGE_SIZE = 20;

/**
 * The sparkline is a month of a rating, one point per day. A pool with no games
 * in that month draws flat at whatever it was carried in at, which is the
 * truth: nothing happened.
 */
const WINDOW_DAYS = 30;
/** How far back to look for the games that fill it. */
const SCAN = 300;
const DAY_MS = 24 * 60 * 60 * 1000;

export type RatingHistory = Record<
	TimeControlCategory,
	{ day: string; rating: number }[]
>;

/** One rated game, from the point of view of the member who played it. */
interface Played {
	category: TimeControlCategory;
	at: Date;
	before: number;
	after: number;
}

function midnight(on: Date = new Date()): Date {
	const day = new Date(on);
	day.setHours(0, 0, 0, 0);
	return day;
}

/** Every day from `start` to `end`, inclusive. */
function daysFrom(start: Date, end: Date): Date[] {
	const count = Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
	return Array.from(
		{ length: Math.max(1, count) },
		(_, index) => new Date(start.getTime() + index * DAY_MS),
	);
}

/** `2026-08-23`. Sortable, and unambiguous about which day it means. */
function isoDay(day: Date): string {
	return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}

/**
 * One pool's line: a rating for every day in the window, carried forward
 * through the days it did not play.
 */
function seriesFor(
	games: Played[],
	today: Date,
): RatingHistory[keyof RatingHistory] {
	const start = new Date(today.getTime() - (WINDOW_DAYS - 1) * DAY_MS);

	const inWindow = games.filter((game) => game.at >= start);
	const earlier = games.filter((game) => game.at < start).at(-1);

	// Where the line begins: what the first game inside the window was played
	// at, else what the last one before it left behind, else the rating every
	// pool starts from.
	let rating = inWindow[0]?.before ?? earlier?.after ?? DEFAULT_RATING;

	return daysFrom(start, today).map((day) => {
		const end = day.getTime() + DAY_MS;
		for (const game of inWindow) {
			if (game.at.getTime() < end) rating = game.after;
		}
		return { day: isoDay(day), rating };
	});
}

/**
 * Public-facing member data. Everything here is readable by any signed-in user,
 * so it must never select `email` or anything else the owner alone should see.
 */
export const memberRouter = createTRPCRouter({
	profile: protectedProcedure
		.input(z.object({ username: z.string().min(1).max(32) }))
		.query(async ({ ctx, input }) => {
			const [member] = await ctx.db
				.select({
					id: users.id,
					username: users.username,
					name: users.name,
					image: users.image,
					country: users.country,
					status: users.status,
					flair: users.flair,
					location: users.location,
					views: users.views,
					createdAt: users.createdAt,
					gamesPlayed: users.gamesPlayed,
					bannedAt: users.bannedAt,
				})
				.from(users)
				.where(eq(users.username, input.username.toLowerCase()))
				.limit(1);

			if (!member) return null;

			// How much they have played. The Games tab shows this beside its own
			// heading; the header no longer does.
			const [played] = await ctx.db
				.select({
					total: sql<number>`count(*)`,
				})
				.from(games)
				.where(
					and(
						or(
							eq(games.whiteUserId, member.id),
							eq(games.blackUserId, member.id),
						),
						ne(games.status, "playing"),
					),
				);

			return {
				...member,
				banned: member.bannedAt !== null,
				/** Games that reached an end, whether they were rated or not. */
				finishedGames: Number(played?.total ?? 0),
				// Per pool, because `member.rating` is only the headline — the
				// profile is the one place that shows the whole picture.
				ratings: await poolsFor(ctx.db, member.id),
			};
		}),

	/**
	 * A member's finished games, newest first, walked with a keyset cursor.
	 *
	 * Keyset rather than an offset: games end while somebody is scrolling, and an
	 * offset would shift every later page down by one, re-showing a game that was
	 * already read. `(startedAt, id)` is the ordering key — `startedAt` alone is
	 * not unique enough to break a tie between two games that began in the same
	 * second.
	 */
	games: protectedProcedure
		.input(
			z.object({
				username: z.string().min(1).max(32),
				limit: z.number().int().min(1).max(50).default(PAGE_SIZE),
				cursor: z.object({ at: z.date(), id: z.string() }).nullish(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const [member] = await ctx.db
				.select({ id: users.id })
				.from(users)
				.where(eq(users.username, input.username.toLowerCase()))
				.limit(1);

			if (!member) return { items: [], nextCursor: null };

			const white = alias(users, "white_user");
			const black = alias(users, "black_user");
			const mine = or(
				eq(games.whiteUserId, member.id),
				eq(games.blackUserId, member.id),
			);
			const filters = [mine, ne(games.status, "playing")];

			if (input.cursor) {
				// Typed operators rather than a `(a, b) < (c, d)` row comparison: a raw
				// comparison hands the driver an unmapped `Date`, which MySQL then
				// reads in the session time zone.
				filters.push(
					or(
						lt(games.startedAt, input.cursor.at),
						and(
							eq(games.startedAt, input.cursor.at),
							lt(games.id, input.cursor.id),
						),
					),
				);
			}

			const rows = await ctx.db
				.select({
					id: games.id,
					timeControl: games.timeControl,
					ranked: games.ranked,
					result: games.result,
					reason: games.reason,
					ply: games.ply,
					startedAt: games.startedAt,
					endedAt: games.endedAt,
					whiteUserId: games.whiteUserId,
					blackUserId: games.blackUserId,
					// The rating each side carried in this game's own pool, which is
					// the only rating a game has: there is no per-member number to
					// fall back to, and a bullet game should never show a blitz one.
					whiteRatingBefore: games.whiteRatingBefore,
					blackRatingBefore: games.blackRatingBefore,
					whiteRatingDelta: games.whiteRatingDelta,
					blackRatingDelta: games.blackRatingDelta,
					whiteUsername: white.username,
					whiteImage: white.image,
					whiteCountry: white.country,
					whiteFlair: white.flair,
					blackUsername: black.username,
					blackImage: black.image,
					blackCountry: black.country,
					blackFlair: black.flair,
				})
				.from(games)
				.innerJoin(white, eq(white.id, games.whiteUserId))
				.innerJoin(black, eq(black.id, games.blackUserId))
				.where(and(...filters))
				.orderBy(desc(games.startedAt), desc(games.id))
				// One row past the page is how we know another page exists without
				// paying for a count.
				.limit(input.limit + 1);

			const page = rows.slice(0, input.limit);
			const last = page.at(-1);

			return {
				nextCursor:
					rows.length > input.limit && last
						? { at: last.startedAt, id: last.id }
						: null,
				items: page.map((row) => {
					const color = row.whiteUserId === member.id ? "w" : "b";
					const viewer = ctx.session.user.id;

					return {
						id: row.id,
						/** The profile owner's side — what `delta` and `outcome` are read from. */
						perspective: color as "w" | "b" | null,
						/** Whose games these are to *look* at is not whose they are to save. */
						mine: row.whiteUserId === viewer || row.blackUserId === viewer,
						white: {
							username: row.whiteUsername,
							rating: row.whiteRatingBefore,
							delta: row.whiteRatingDelta,
							image: row.whiteImage,
							country: row.whiteCountry,
							flair: row.whiteFlair,
						},
						black: {
							username: row.blackUsername,
							rating: row.blackRatingBefore,
							delta: row.blackRatingDelta,
							image: row.blackImage,
							country: row.blackCountry,
							flair: row.blackFlair,
						},
						outcome: outcomeFor(row.result, color),
						result: row.result,
						reason: row.reason,
						timeControl: row.timeControl,
						ranked: row.ranked,
						moves: Math.ceil(row.ply / 2),
						playedAt: row.endedAt ?? row.startedAt,
					};
				}),
			};
		}),

	/** One game with its move sheet, for the replay page. */
	/**
	 * Where each pool has been lately: the rating after every rated game, oldest
	 * first, capped at `POINTS` per pool.
	 *
	 * Derived from the games rather than stored, because the rating a game was
	 * played at is already on the row — a separate history table would be a
	 * second copy of the same truth, free to drift.
	 */
	ratingHistory: protectedProcedure
		.input(z.object({ username: z.string().min(1).max(32) }))
		.query(async ({ ctx, input }) => {
			const today = midnight();

			const build = (games: Played[]) =>
				Object.fromEntries(
					TIME_CONTROL_CATEGORIES.map((category) => [
						category,
						seriesFor(
							games.filter((game) => game.category === category),
							today,
						),
					]),
				) as RatingHistory;

			const [member] = await ctx.db
				.select({ id: users.id })
				.from(users)
				.where(eq(users.username, input.username.toLowerCase()))
				.limit(1);

			if (!member) return build([]);

			// Newest first so the cap keeps the recent end; the run before the
			// window matters too, because it is what the line starts at.
			const rows = await ctx.db
				.select({
					timeControl: games.timeControl,
					startedAt: games.startedAt,
					whiteUserId: games.whiteUserId,
					whiteBefore: games.whiteRatingBefore,
					whiteDelta: games.whiteRatingDelta,
					blackBefore: games.blackRatingBefore,
					blackDelta: games.blackRatingDelta,
				})
				.from(games)
				.where(
					and(
						or(
							eq(games.whiteUserId, member.id),
							eq(games.blackUserId, member.id),
						),
						// A delta is only written when the rating was applied, which is
						// exactly the set of games that moved one.
						isNotNull(games.whiteRatingDelta),
					),
				)
				.orderBy(desc(games.startedAt), desc(games.id))
				.limit(SCAN);

			// The rating a game was played at is the one for the side the member
			// sat on, which is what the row already stores.
			const played = rows
				.map((row): Played | null => {
					const mine = row.whiteUserId === member.id;
					const before = mine ? row.whiteBefore : row.blackBefore;
					const delta = mine ? row.whiteDelta : row.blackDelta;
					if (before === null || delta === null) return null;

					return {
						category: resolveTimeControl(row.timeControl).category,
						at: row.startedAt,
						before,
						after: before + delta,
					};
				})
				.filter((game) => game !== null)
				.reverse(); // oldest first

			return build(played);
		}),

	game: protectedProcedure
		.input(z.object({ id: z.string().min(1).max(36) }))
		.query(async ({ ctx, input }) => {
			const white = alias(users, "white_user");
			const black = alias(users, "black_user");

			const [game] = await ctx.db
				.select({
					id: games.id,
					timeControl: games.timeControl,
					initialTimeMs: games.initialTimeMs,
					incrementMs: games.incrementMs,
					ranked: games.ranked,
					status: games.status,
					result: games.result,
					reason: games.reason,
					winnerColor: games.winnerColor,
					moves: games.moves,
					pgn: games.pgn,
					ply: games.ply,
					startedAt: games.startedAt,
					endedAt: games.endedAt,
					whiteUsername: white.username,
					whiteFlair: white.flair,
					whiteCountry: white.country,
					whiteImage: white.image,
					whiteRating: games.whiteRatingBefore,
					whiteDelta: games.whiteRatingDelta,
					blackUsername: black.username,
					blackFlair: black.flair,
					blackCountry: black.country,
					blackImage: black.image,
					blackRating: games.blackRatingBefore,
					blackDelta: games.blackRatingDelta,
				})
				.from(games)
				.innerJoin(white, eq(white.id, games.whiteUserId))
				.innerJoin(black, eq(black.id, games.blackUserId))
				.where(eq(games.id, input.id))
				.limit(1);

			if (!game) return null;

			// `fen_after` per ply is what makes stepping through free: no move
			// replay on the client, just an index into this list.
			const history = await ctx.db
				.select({
					ply: gamesHistory.ply,
					color: gamesHistory.color,
					san: gamesHistory.san,
					fromSquare: gamesHistory.fromSquare,
					toSquare: gamesHistory.toSquare,
					fenAfter: gamesHistory.fenAfter,
					clockMs: gamesHistory.clockMs,
					thinkMs: gamesHistory.thinkMs,
				})
				.from(gamesHistory)
				.where(eq(gamesHistory.gameId, input.id))
				.orderBy(asc(gamesHistory.ply));

			return { ...game, history };
		}),
});
