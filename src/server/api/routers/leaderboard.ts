import { and, asc, desc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { z } from "zod";

import { isCountryCode } from "@/lib/countries";
import {
	TIME_CONTROL_CATEGORIES,
	TIME_CONTROLS,
	type TimeControlCategory,
} from "@/lib/timeControls";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { games, userRatings, users } from "@/server/db/schema";

/** How many each pool shows on the index, before "See all". */
const PREVIEW = 5;

const categoryInput = z.enum(TIME_CONTROL_CATEGORIES);

/**
 * `?country=RO` narrows a board to one flag. Validated rather than trusted:
 * an unknown code would otherwise be a filter that silently matches nothing.
 */
const countryInput = z
	.string()
	.length(2)
	.refine(isCountryCode, "Not an ISO 3166-1 alpha-2 code")
	.transform((code) => code.toUpperCase())
	.nullish();

/** The clocks that count towards one pool — `3+0`, `5+3` and so on for blitz. */
function clocksIn(category: TimeControlCategory): string[] {
	return Object.values(TIME_CONTROLS)
		.filter((control) => control.category === category)
		.map((control) => control.id);
}

/**
 * Standings, one pool at a time.
 *
 * Ranked on `user_rating`, which only has a row once somebody has played the
 * pool — so a leaderboard is exactly the people who have earned a place on it,
 * with no provisional 1500s padding the bottom.
 */
export const leaderboardRouter = createTRPCRouter({
	/** The top few in every pool, for the index. */
	overview: protectedProcedure
		.input(z.object({ country: countryInput }).optional())
		.query(async ({ ctx, input }) => {
			// One query, ranked within each pool by a window function, rather than
			// four round trips that would have to be stitched together anyway.
			const country = input?.country ?? null;

			// Ranked *after* the country filter, not before: a national board
			// numbers 1, 2, 3 down its own list rather than showing the global
			// places of whoever happens to share a flag.
			const eligible = ctx.db
				.select({
					category: userRatings.category,
					rating: userRatings.rating,
					gamesPlayed: userRatings.gamesPlayed,
					userId: userRatings.userId,
					username: users.username,
					image: users.image,
					country: users.country,
					flair: users.flair,
				})
				.from(userRatings)
				.innerJoin(users, eq(users.id, userRatings.userId))
				.where(country ? eq(users.country, country) : undefined)
				.as("eligible");

			const ranked = ctx.db
				.select({
					category: eligible.category,
					rating: eligible.rating,
					gamesPlayed: eligible.gamesPlayed,
					username: eligible.username,
					image: eligible.image,
					country: eligible.country,
					flair: eligible.flair,
					place:
						sql<number>`row_number() over (partition by ${eligible.category} order by ${eligible.rating} desc, ${eligible.gamesPlayed} desc)`.as(
							"place",
						),
				})
				.from(eligible)
				.as("ranked");

			const rows = await ctx.db
				.select()
				.from(ranked)
				.where(sql`${ranked.place} <= ${PREVIEW}`)
				.orderBy(ranked.category, ranked.place);

			// Every category comes back, empty ones included: a pool nobody has
			// played yet is a fact about the site worth showing.
			return TIME_CONTROL_CATEGORIES.map((category) => ({
				category,
				players: rows
					.filter((row) => row.category === category)
					.map(({ category: _, ...player }) => player),
			}));
		}),

	/**
	 * The flags with somebody on a board, for the filter.
	 *
	 * Drawn from the members who are actually ranked rather than from the full
	 * ISO list: a picker of two hundred countries where all but four are empty
	 * is a worse control than a short one that is true.
	 */
	countries: protectedProcedure.query(async ({ ctx }) => {
		const rows = await ctx.db
			.selectDistinct({ code: users.country })
			.from(users)
			.innerJoin(userRatings, eq(userRatings.userId, users.id))
			.where(isNotNull(users.country))
			.orderBy(asc(users.country));

		return rows
			.map((row) => row.code)
			.filter((code): code is string => code !== null);
	}),

	/**
	 * One pool in full, with each player's record in it.
	 *
	 * Paged by offset rather than a cursor, which is the one place offsets are
	 * the right answer: a leaderboard is a list of *positions*, so the rank of a
	 * row is its offset, and a standing that shifts under a reader is the table
	 * doing its job rather than a bug to design around.
	 */
	standings: protectedProcedure
		.input(
			z.object({
				category: categoryInput,
				country: countryInput,
				limit: z.number().int().min(1).max(100).default(25),
				cursor: z.number().int().min(0).nullish(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const offset = input.cursor ?? 0;

			const page = await ctx.db
				.select({
					id: users.id,
					username: users.username,
					image: users.image,
					country: users.country,
					flair: users.flair,
					rating: userRatings.rating,
					deviation: userRatings.ratingDeviation,
					gamesPlayed: userRatings.gamesPlayed,
				})
				.from(userRatings)
				.innerJoin(users, eq(users.id, userRatings.userId))
				.where(
					and(
						eq(userRatings.category, input.category),
						input.country ? eq(users.country, input.country) : undefined,
					),
				)
				.orderBy(
					desc(userRatings.rating),
					desc(userRatings.gamesPlayed),
					users.username,
				)
				.limit(input.limit + 1)
				.offset(offset);

			const rows = page.slice(0, input.limit);
			const records = await recordsFor(
				ctx.db,
				input.category,
				rows.map((row) => row.id),
			);

			return {
				items: rows.map((row, index) => ({
					...row,
					place: offset + index + 1,
					record: records.get(row.id) ?? { wins: 0, draws: 0, losses: 0 },
				})),
				nextCursor:
					page.length > input.limit ? offset + input.limit : (null as null),
			};
		}),
});

interface Record_ {
	wins: number;
	draws: number;
	losses: number;
}

/**
 * Win/draw/loss in one pool, for a page of players.
 *
 * Two grouped queries rather than one with an `or` in the join: a player is
 * White in some of their games and Black in the others, and each half has an
 * index of its own to run down (`games_white_idx`, `games_black_idx`).
 */
async function recordsFor(
	db: typeof import("@/server/db").db,
	category: TimeControlCategory,
	userIds: string[],
): Promise<Map<string, Record_>> {
	const tally = new Map<string, Record_>();
	if (userIds.length === 0) return tally;

	const clocks = clocksIn(category);
	const add = (id: string, key: keyof Record_, count: number) => {
		const row = tally.get(id) ?? { wins: 0, draws: 0, losses: 0 };
		row[key] += count;
		tally.set(id, row);
	};

	for (const side of ["w", "b"] as const) {
		const seat = side === "w" ? games.whiteUserId : games.blackUserId;
		const won = side === "w" ? "1-0" : "0-1";
		const lost = side === "w" ? "0-1" : "1-0";

		const rows = await db
			.select({
				id: seat,
				wins: sql<number>`sum(case when ${games.result} = ${won} then 1 else 0 end)`,
				losses: sql<number>`sum(case when ${games.result} = ${lost} then 1 else 0 end)`,
				draws: sql<number>`sum(case when ${games.result} = '1/2-1/2' then 1 else 0 end)`,
			})
			.from(games)
			.where(
				and(
					inArray(seat, userIds),
					inArray(games.timeControl, clocks),
					eq(games.ranked, true),
					ne(games.status, "playing"),
				),
			)
			.groupBy(seat);

		for (const row of rows) {
			add(row.id, "wins", Number(row.wins));
			add(row.id, "losses", Number(row.losses));
			add(row.id, "draws", Number(row.draws));
		}
	}

	return tally;
}
