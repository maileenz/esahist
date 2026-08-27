import "server-only";

import { eq, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { users } from "@/server/db/schema";

/**
 * Count one look at somebody's profile.
 *
 * `views + 1` in SQL rather than read-then-write: two people opening the same
 * profile at once would otherwise both read the same number and both store it,
 * and the second view would be free. The database is the only thing that can
 * settle that, so it does.
 *
 * Never throws. It is called from `after()`, where the response has already
 * been sent — there is nobody left to tell, and a counter is not worth an
 * unhandled rejection in the server log.
 *
 * Lives here rather than under `server/db/` because the game server's tsconfig
 * compiles that whole directory, and this is Next-only: it is `server-only`,
 * and it resolves the `@/` alias the game server does not have.
 */
export async function recordProfileView(userId: string): Promise<void> {
	try {
		await db
			.update(users)
			.set({ views: sql`${users.views} + 1` })
			.where(eq(users.id, userId));
	} catch (error) {
		console.error("[views] could not record a profile view", error);
	}
}
