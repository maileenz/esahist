import { TRPCError } from "@trpc/server";
import { desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "@/server/api/trpc";
import { reportStatus, userReports, users } from "@/server/db/schema";

const PAGE_SIZE = 25;

/**
 * The moderation queue. Every procedure here is an `adminProcedure`, so the
 * role check lives in one place rather than being repeated per handler.
 */
export const adminRouter = createTRPCRouter({
	reports: adminProcedure
		.input(
			z.object({
				status: z.enum(reportStatus).default("open"),
				page: z.number().int().min(0).default(0),
			}),
		)
		.query(async ({ ctx, input }) => {
			const reporter = alias(users, "reporter");
			const reported = alias(users, "reported");

			const [counted] = await ctx.db
				.select({ total: sql<number>`count(*)` })
				.from(userReports)
				.where(eq(userReports.status, input.status));

			const rows = await ctx.db
				.select({
					id: userReports.id,
					reason: userReports.reason,
					status: userReports.status,
					createdAt: userReports.createdAt,
					reporterName: reporter.name,
					reporterUsername: reporter.username,
					reportedName: reported.name,
					reportedUsername: reported.username,
					reportedImage: reported.image,
					reportedBannedAt: reported.bannedAt,
				})
				.from(userReports)
				.innerJoin(reporter, eq(reporter.id, userReports.reporterId))
				.innerJoin(reported, eq(reported.id, userReports.reportedId))
				.where(eq(userReports.status, input.status))
				.orderBy(desc(userReports.createdAt))
				.limit(PAGE_SIZE)
				.offset(input.page * PAGE_SIZE);

			return {
				page: input.page,
				total: Number(counted?.total ?? 0),
				pageSize: PAGE_SIZE,
				rows: rows.map((row) => ({
					...row,
					reportedBanned: row.reportedBannedAt !== null,
				})),
			};
		}),

	/** How many are waiting, for the header badge. */
	openCount: adminProcedure.query(async ({ ctx }) => {
		const [row] = await ctx.db
			.select({ total: sql<number>`count(*)` })
			.from(userReports)
			.where(eq(userReports.status, "open"));

		return Number(row?.total ?? 0);
	}),

	/** Take a report out of the queue, either way. */
	resolve: adminProcedure
		.input(
			z.object({
				id: z.string().min(1).max(36),
				status: z.enum(["reviewed", "dismissed"]),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await ctx.db
				.update(userReports)
				.set({ status: input.status })
				.where(eq(userReports.id, input.id));

			return { status: input.status };
		}),

	/**
	 * Suspend or restore a member. `banned_at` is what the game server checks in
	 * `onAuth`, so a ban stops them joining a room on their next attempt; it does
	 * not end a game already in progress.
	 */
	setBanned: adminProcedure
		.input(
			z.object({ username: z.string().min(1).max(32), banned: z.boolean() }),
		)
		.mutation(async ({ ctx, input }) => {
			const [member] = await ctx.db
				.select({ id: users.id, role: users.role })
				.from(users)
				.where(eq(users.username, input.username.toLowerCase()))
				.limit(1);

			if (!member) {
				throw new TRPCError({ code: "NOT_FOUND", message: "No such member" });
			}

			// Locking each other out is not a moderation workflow anybody wants.
			if (member.role === "admin") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Admins cannot be suspended from here",
				});
			}

			await ctx.db
				.update(users)
				.set({ bannedAt: input.banned ? new Date() : null })
				.where(eq(users.id, member.id));

			return { banned: input.banned };
		}),
});
