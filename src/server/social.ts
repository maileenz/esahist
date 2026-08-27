import { and, eq, or } from "drizzle-orm";

import type { db as database } from "@/server/db";
import { friendships, userBlocks } from "@/server/db/schema";

/**
 * Block one member on behalf of another.
 *
 * Lives here rather than in the friend router because reporting can block too,
 * and "blocking" has to mean the same thing from both doors: the friendship
 * goes, then the block lands.
 */
export async function blockMember(
	db: typeof database,
	blockerId: string,
	blockedId: string,
): Promise<void> {
	await db
		.delete(friendships)
		.where(
			or(
				and(
					eq(friendships.requesterId, blockerId),
					eq(friendships.addresseeId, blockedId),
				),
				and(
					eq(friendships.requesterId, blockedId),
					eq(friendships.addresseeId, blockerId),
				),
			),
		);

	await db
		.insert(userBlocks)
		.values({ blockerId, blockedId })
		// Blocking twice is not an error.
		.onDuplicateKeyUpdate({ set: { blockerId } });
}
