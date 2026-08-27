import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { REPORT_REASONS } from "@/lib/reportReasons";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { userReports, users } from "@/server/db/schema";
import { blockMember } from "@/server/social";

export const reportRouter = createTRPCRouter({
	/**
	 * File a report, optionally blocking the member at the same time — the two
	 * happen together because that is how the dialog offers them.
	 */
	create: protectedProcedure
		.input(
			z.object({
				username: z.string().min(1).max(32),
				reason: z.enum(REPORT_REASONS),
				block: z.boolean().default(false),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const reporterId = ctx.session.user.id;

			const [member] = await ctx.db
				.select({ id: users.id })
				.from(users)
				.where(eq(users.username, input.username.toLowerCase()))
				.limit(1);

			if (!member) {
				throw new TRPCError({ code: "NOT_FOUND", message: "No such member" });
			}

			if (member.id === reporterId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "You cannot report yourself",
				});
			}

			// One open report per pair. Filing again while the first is still in the
			// queue adds nothing for a moderator and is the obvious way to spam.
			const [pending] = await ctx.db
				.select({ id: userReports.id })
				.from(userReports)
				.where(
					and(
						eq(userReports.reporterId, reporterId),
						eq(userReports.reportedId, member.id),
						eq(userReports.status, "open"),
					),
				)
				.limit(1);

			if (!pending) {
				await ctx.db.insert(userReports).values({
					reporterId,
					reportedId: member.id,
					reason: input.reason,
				});
			}

			if (input.block) {
				await blockMember(ctx.db, reporterId, member.id);
			}

			return { filed: !pending, alreadyReported: Boolean(pending) };
		}),
});
