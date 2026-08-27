import { like } from "drizzle-orm";

import { slugifyUsername, USERNAME_MAX_LENGTH } from "@/lib/username";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";

/**
 * The first free variant of `preferred`: `alex`, then `alex-2`, `alex-3`…
 *
 * Called from the providers' `profile()` during sign-in, which is before the
 * adapter inserts the row. Two people claiming the same handle in the same
 * instant would still collide on the unique index — the column's `$defaultFn`
 * is what keeps that from turning into a failed sign-in.
 */
export async function uniqueUsername(preferred: string): Promise<string> {
	const base = slugifyUsername(preferred);

	try {
		const rows = await db
			.select({ username: users.username })
			.from(users)
			.where(like(users.username, `${base}%`));

		const taken = new Set(rows.map((row) => row.username.toLowerCase()));
		if (!taken.has(base)) return base;

		for (let suffix = 2; suffix < 1000; suffix++) {
			const candidate = `${base.slice(0, USERNAME_MAX_LENGTH - 5)}-${suffix}`;
			if (!taken.has(candidate)) return candidate;
		}
	} catch (err) {
		// A lookup failure must not block sign-in; the column default covers it.
		console.error("[auth] username lookup failed", err);
	}

	return `${base.slice(0, 24)}-${Math.random().toString(36).slice(2, 6)}`;
}
