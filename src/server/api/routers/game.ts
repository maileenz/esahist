import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { poolsFor } from "@/server/db/ratings";
import { games, users } from "@/server/db/schema";

/**
 * Read models for the lobby. Everything that decides a game's outcome lives in
 * the Colyseus room — this router only reads what the room already wrote.
 *
 * A member's history is not here: it lives on the profile, in `member.profile`
 * and `member.games`.
 */
export const gameRouter = createTRPCRouter({
	/**
	 * Your own rating in every pool, for the lobby.
	 *
	 * The lobby needs all four rather than one: the number it shows and the
	 * matchmaking bucket it asks for both change the moment you pick a different
	 * clock, and a round trip per click would make the picker feel broken.
	 */
	ratings: protectedProcedure.query(({ ctx }) =>
		poolsFor(ctx.db, ctx.session.user.id),
	),

	/**
	 * Who is sitting in the bottom seat.
	 *
	 * The board shows you before a game exists, so the lobby needs the same
	 * handful of fields a live seat carries. The session has the username and
	 * the picture but not the flag or the flair, which is what this is for.
	 */
	seat: protectedProcedure.query(async ({ ctx }) => {
		const [row] = await ctx.db
			.select({
				username: users.username,
				image: users.image,
				country: users.country,
				flair: users.flair,
			})
			.from(users)
			.where(eq(users.id, ctx.session.user.id))
			.limit(1);

		// The session guarantees the row; this is for the type, not for a case
		// that can happen.
		if (!row) throw new TRPCError({ code: "NOT_FOUND" });

		return row;
	}),

	/** Site activity for the lobby footer. Both numbers come from the games table. */
	stats: protectedProcedure.query(async ({ ctx }) => {
		const startOfDay = new Date();
		startOfDay.setHours(0, 0, 0, 0);

		const [row] = await ctx.db
			.select({
				inPlay: sql<number>`sum(case when ${games.status} = 'playing' then 1 else 0 end)`,
				gamesToday: sql<number>`sum(case when ${games.startedAt} >= ${startOfDay} then 1 else 0 end)`,
			})
			.from(games);

		return {
			// Two seats per live game — the room never starts one with an empty seat.
			playing: Number(row?.inPlay ?? 0) * 2,
			gamesToday: Number(row?.gamesToday ?? 0),
		};
	}),
});
