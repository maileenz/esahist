import { TRPCError } from "@trpc/server";
import { and, desc, eq, like, lt, or } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import type { db as database } from "@/server/db";
import { friendships, userBlocks, users } from "@/server/db/schema";
import { blockMember } from "@/server/social";

/**
 * What the viewer sees on someone's profile. `blocked` means *you* blocked
 * them; there is deliberately no state for "they blocked you" — see
 * `blockBetween`.
 */
export type FriendState =
	| "self"
	| "none"
	| "friends"
	| "incoming"
	| "outgoing"
	| "blocked";

const usernameInput = z.object({ username: z.string().min(1).max(32) });

/**
 * Blocks in both directions between two people.
 *
 * Being blocked is never surfaced to the person who was blocked: they see an
 * ordinary profile and their friend request fails with a message that does not
 * confirm why. Only `youBlocked` drives the UI.
 */
async function blockBetween(
	db: typeof database,
	viewerId: string,
	otherId: string,
) {
	const rows = await db
		.select({
			blockerId: userBlocks.blockerId,
			blockedId: userBlocks.blockedId,
		})
		.from(userBlocks)
		.where(
			or(
				and(
					eq(userBlocks.blockerId, viewerId),
					eq(userBlocks.blockedId, otherId),
				),
				and(
					eq(userBlocks.blockerId, otherId),
					eq(userBlocks.blockedId, viewerId),
				),
			),
		);

	return {
		youBlocked: rows.some((row) => row.blockerId === viewerId),
		theyBlocked: rows.some((row) => row.blockerId === otherId),
		any: rows.length > 0,
	};
}

type Database = typeof database;

async function findMember(db: Database, username: string) {
	const [row] = await db
		.select({ id: users.id, username: users.username })
		.from(users)
		.where(eq(users.username, username.toLowerCase()))
		.limit(1);

	if (!row)
		throw new TRPCError({ code: "NOT_FOUND", message: "No such member" });
	return row;
}

/** The single row between two people, whichever way round it was asked. */
async function relationBetween(db: typeof database, a: string, b: string) {
	const [row] = await db
		.select({
			requesterId: friendships.requesterId,
			addresseeId: friendships.addresseeId,
			status: friendships.status,
			createdAt: friendships.createdAt,
			respondedAt: friendships.respondedAt,
		})
		.from(friendships)
		.where(
			or(
				and(eq(friendships.requesterId, a), eq(friendships.addresseeId, b)),
				and(eq(friendships.requesterId, b), eq(friendships.addresseeId, a)),
			),
		)
		.limit(1);

	return row ?? null;
}

function stateOf(
	row: Awaited<ReturnType<typeof relationBetween>>,
	viewerId: string,
): FriendState {
	if (!row) return "none";
	if (row.status === "accepted") return "friends";
	return row.requesterId === viewerId ? "outgoing" : "incoming";
}

export const friendRouter = createTRPCRouter({
	/** The viewer's relationship with one member, for the profile button. */
	status: protectedProcedure
		.input(usernameInput)
		.query(async ({ ctx, input }): Promise<{ state: FriendState }> => {
			const viewerId = ctx.session.user.id;
			const member = await findMember(ctx.db, input.username);
			if (member.id === viewerId) return { state: "self" };

			const block = await blockBetween(ctx.db, viewerId, member.id);
			// Your own block is shown; theirs reads as an ordinary "none", so a
			// blocked member cannot tell a block from simple indifference.
			if (block.youBlocked) return { state: "blocked" };
			if (block.theyBlocked) return { state: "none" };

			const row = await relationBetween(ctx.db, viewerId, member.id);
			return { state: stateOf(row, viewerId) };
		}),

	/**
	 * Blocking tears the relationship down: any friendship or pending request
	 * between the two is deleted, and neither side can open a new one until the
	 * block is lifted.
	 */
	block: protectedProcedure
		.input(usernameInput)
		.mutation(async ({ ctx, input }): Promise<{ state: FriendState }> => {
			const viewerId = ctx.session.user.id;
			const member = await findMember(ctx.db, input.username);

			if (member.id === viewerId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "You cannot block yourself",
				});
			}

			await blockMember(ctx.db, viewerId, member.id);

			return { state: "blocked" };
		}),

	unblock: protectedProcedure
		.input(usernameInput)
		.mutation(async ({ ctx, input }): Promise<{ state: FriendState }> => {
			const viewerId = ctx.session.user.id;
			const member = await findMember(ctx.db, input.username);

			await ctx.db
				.delete(userBlocks)
				.where(
					and(
						eq(userBlocks.blockerId, viewerId),
						eq(userBlocks.blockedId, member.id),
					),
				);

			// Unblocking does not restore the old friendship — it was deleted.
			return { state: "none" };
		}),

	/** Everyone the viewer has blocked. Never readable for anyone else. */
	blocked: protectedProcedure.query(async ({ ctx }) => {
		return await ctx.db
			.select({
				username: users.username,
				image: users.image,
				country: users.country,
				flair: users.flair,
				at: userBlocks.createdAt,
			})
			.from(userBlocks)
			.innerJoin(users, eq(users.id, userBlocks.blockedId))
			.where(eq(userBlocks.blockerId, ctx.session.user.id))
			.orderBy(desc(userBlocks.createdAt));
	}),

	request: protectedProcedure
		.input(usernameInput)
		.mutation(async ({ ctx, input }): Promise<{ state: FriendState }> => {
			const viewerId = ctx.session.user.id;
			const member = await findMember(ctx.db, input.username);

			if (member.id === viewerId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "You cannot befriend yourself",
				});
			}

			// Deliberately one message for both directions: it must not reveal
			// whether they blocked you or you blocked them.
			const block = await blockBetween(ctx.db, viewerId, member.id);
			if (block.any) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "This member is not accepting friend requests",
				});
			}

			const existing = await relationBetween(ctx.db, viewerId, member.id);

			if (existing?.status === "accepted") return { state: "friends" };

			// They asked first: treat this as the acceptance rather than opening a
			// second, mirror-image request.
			if (existing && existing.requesterId === member.id) {
				await ctx.db
					.update(friendships)
					.set({ status: "accepted", respondedAt: new Date() })
					.where(
						and(
							eq(friendships.requesterId, member.id),
							eq(friendships.addresseeId, viewerId),
						),
					);
				return { state: "friends" };
			}

			if (existing) return { state: "outgoing" };

			await ctx.db
				.insert(friendships)
				.values({ requesterId: viewerId, addresseeId: member.id })
				// A double-click must not raise a duplicate-key error.
				.onDuplicateKeyUpdate({ set: { requesterId: viewerId } });

			return { state: "outgoing" };
		}),

	/** Accept or decline a request that was sent to the viewer. */
	respond: protectedProcedure
		.input(usernameInput.extend({ accept: z.boolean() }))
		.mutation(async ({ ctx, input }): Promise<{ state: FriendState }> => {
			const viewerId = ctx.session.user.id;
			const member = await findMember(ctx.db, input.username);

			const where = and(
				eq(friendships.requesterId, member.id),
				eq(friendships.addresseeId, viewerId),
				eq(friendships.status, "pending"),
			);

			const [pending] = await ctx.db
				.select({ requesterId: friendships.requesterId })
				.from(friendships)
				.where(where)
				.limit(1);

			if (!pending) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "No pending request from that member",
				});
			}

			if (!input.accept) {
				// Declining leaves no trace, so either side is free to ask again.
				await ctx.db.delete(friendships).where(where);
				return { state: "none" };
			}

			await ctx.db
				.update(friendships)
				.set({ status: "accepted", respondedAt: new Date() })
				.where(where);

			return { state: "friends" };
		}),

	/** Unfriend, cancel a request you sent, or withdraw either way round. */
	remove: protectedProcedure
		.input(usernameInput)
		.mutation(async ({ ctx, input }): Promise<{ state: FriendState }> => {
			const viewerId = ctx.session.user.id;
			const member = await findMember(ctx.db, input.username);

			await ctx.db
				.delete(friendships)
				.where(
					or(
						and(
							eq(friendships.requesterId, viewerId),
							eq(friendships.addresseeId, member.id),
						),
						and(
							eq(friendships.requesterId, member.id),
							eq(friendships.addresseeId, viewerId),
						),
					),
				);

			return { state: "none" };
		}),

	/**
	 * A member's accepted friends, newest first. Visible to any signed-in viewer.
	 *
	 * Cursored rather than paged, because the list is scrolled rather than
	 * navigated. The cursor is a keyset — `(createdAt, id)` compared as a row —
	 * so a friendship accepted while someone is scrolling cannot shift the window
	 * and make a row repeat or vanish, the way an offset would. `createdAt` is
	 * the ordering key rather than `respondedAt` because it is never null.
	 */
	list: protectedProcedure
		.input(
			usernameInput.extend({
				/** Matches the display name or the username, case-insensitively. */
				search: z.string().max(64).optional(),
				limit: z.number().int().min(1).max(50).default(20),
				cursor: z.object({ at: z.date(), id: z.string() }).nullish(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const member = await findMember(ctx.db, input.username);

			const mine = or(
				eq(friendships.requesterId, member.id),
				eq(friendships.addresseeId, member.id),
			);

			const filters = [eq(friendships.status, "accepted"), mine];

			const term = input.search?.trim();
			if (term) {
				// `%` and `_` are LIKE wildcards and `\` is its escape character; a
				// member searching for "a_b" means the literal text, so all three are
				// escaped rather than passed through.
				const pattern = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
				filters.push(
					or(like(users.name, pattern), like(users.username, pattern)),
				);
			}

			if (input.cursor) {
				// Keyset, spelled out with typed operators rather than a `(a, b) < (c, d)`
				// row comparison: a raw comparison hands the driver an unmapped `Date`,
				// which MySQL then reads in the session time zone — off by the UTC
				// offset, which silently let every row through and re-served page one.
				filters.push(
					or(
						lt(friendships.createdAt, input.cursor.at),
						and(
							eq(friendships.createdAt, input.cursor.at),
							lt(users.id, input.cursor.id),
						),
					),
				);
			}

			// The join picks whichever side of the row is *not* `member`, so these
			// columns are always the friend rather than the requester.
			const rows = await ctx.db
				.select({
					id: users.id,
					at: friendships.createdAt,
					since: friendships.respondedAt,
					friendUsername: users.username,
					friendImage: users.image,
					friendCountry: users.country,
					friendFlair: users.flair,
				})
				.from(friendships)
				.innerJoin(
					users,
					or(
						and(
							eq(friendships.requesterId, member.id),
							eq(users.id, friendships.addresseeId),
						),
						and(
							eq(friendships.addresseeId, member.id),
							eq(users.id, friendships.requesterId),
						),
					),
				)
				.where(and(...filters))
				.orderBy(desc(friendships.createdAt), desc(users.id))
				// One extra row is how we know whether another page exists without
				// running a second count query.
				.limit(input.limit + 1);

			const page = rows.slice(0, input.limit);
			const last = page.at(-1);

			return {
				items: page.map((row) => ({
					username: row.friendUsername,
					image: row.friendImage,
					country: row.friendCountry,
					flair: row.friendFlair,
					since: row.since,
				})),
				nextCursor:
					rows.length > input.limit && last
						? { at: last.at, id: last.id }
						: null,
			};
		}),

	/** The viewer's own inbox and outbox. Never anyone else's. */
	pending: protectedProcedure.query(async ({ ctx }) => {
		const viewerId = ctx.session.user.id;

		const incoming = await ctx.db
			.select({
				username: users.username,
				image: users.image,
				country: users.country,
				flair: users.flair,
				at: friendships.createdAt,
			})
			.from(friendships)
			.innerJoin(users, eq(users.id, friendships.requesterId))
			.where(
				and(
					eq(friendships.addresseeId, viewerId),
					eq(friendships.status, "pending"),
				),
			)
			.orderBy(desc(friendships.createdAt));

		const outgoing = await ctx.db
			.select({
				username: users.username,
				image: users.image,
				country: users.country,
				flair: users.flair,
				at: friendships.createdAt,
			})
			.from(friendships)
			.innerJoin(users, eq(users.id, friendships.addresseeId))
			.where(
				and(
					eq(friendships.requesterId, viewerId),
					eq(friendships.status, "pending"),
				),
			)
			.orderBy(desc(friendships.createdAt));

		return { incoming, outgoing };
	}),

	/** Just the number, for the header badge. */
	pendingCount: protectedProcedure.query(async ({ ctx }) => {
		const rows = await ctx.db
			.select({ requesterId: friendships.requesterId })
			.from(friendships)
			.where(
				and(
					eq(friendships.addresseeId, ctx.session.user.id),
					eq(friendships.status, "pending"),
				),
			);

		return rows.length;
	}),
});
