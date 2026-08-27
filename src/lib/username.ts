/**
 * Pure string helpers, no database — the backfill script imports these without
 * dragging in a connection pool.
 */

export const USERNAME_MAX_LENGTH = 32;

/**
 * Provider handles are not URL-safe: Discord allows dots, GitHub allows a
 * leading dash, display names allow anything at all. Reduce to the set that
 * survives a path segment untouched.
 */
export function slugifyUsername(raw: string): string {
	const slug = raw
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "") // combining marks left by NFKD
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, USERNAME_MAX_LENGTH);

	return slug.length >= 2
		? slug
		: `player-${Math.random().toString(36).slice(2, 8)}`;
}

/** Cheap guard before hitting the database with a path segment. */
export function isPlausibleUsername(value: string): boolean {
	return /^[a-z0-9][a-z0-9-]{0,31}$/.test(value.toLowerCase());
}
