import { and, eq, or } from "drizzle-orm";

import { db } from "../../db";
import { userBlocks } from "../../db/schema";

/**
 * Has either of these two blocked the other? Checked before a seat is taken, so
 * a block keeps you out of each other's games and not just each other's friend
 * lists.
 *
 * Fails **open**, unlike `authenticate`: a database hiccup that stopped every
 * game from starting would be a far worse outcome than a blocked pair being
 * matched once. There is no security boundary here — both players consented to
 * play a stranger.
 */
export async function areBlocked(a: string, b: string): Promise<boolean> {
	if (!process.env.DATABASE_URL) return false;

	try {
		const rows = await db
			.select({ blockerId: userBlocks.blockerId })
			.from(userBlocks)
			.where(
				or(
					and(eq(userBlocks.blockerId, a), eq(userBlocks.blockedId, b)),
					and(eq(userBlocks.blockerId, b), eq(userBlocks.blockedId, a)),
				),
			)
			.limit(1);

		return rows.length > 0;
	} catch (err) {
		console.error("[blocks] lookup failed", err);
		return false;
	}
}
