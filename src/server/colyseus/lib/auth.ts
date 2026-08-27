import type { AuthContext } from "colyseus";
import { parseCookie } from "cookie";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../../db";
import { emptyPools, poolsFor, type RatingPools } from "../../db/ratings";
import {
	DEFAULT_DEVIATION,
	DEFAULT_RATING,
	DEFAULT_VOLATILITY,
	sessions,
	users,
} from "../../db/schema";

/**
 * The identity a room trusts. It comes from the `sessions` row Auth.js wrote at
 * sign-in — the same row `auth()` reads inside Next.js.
 */
export interface AuthUser {
	id: string;
	/** URL identity, so the board can link a seat to `/member/<username>`. */
	username: string;
	name: string;
	/** ISO 3166-1 alpha-2, or null when the member has not set one. */
	country: string | null;
	/** Catalogue id from `lib/flairs`, so a seat wears it mid-game. */
	flair: string | null;
	image: string | null;
	/**
	 * The rating at stake, once the room has narrowed it. Before `onJoin` runs
	 * it is only a placeholder: a member has no rating of their own, only one
	 * per pool.
	 */
	rating: number;
	/** Glicko-2 state for that same pool, which is what rates the game. */
	deviation: number;
	volatility: number;
	gamesPlayed: number;
	/** Every pool, so the room can pick the one that matches its time control. */
	ratings: RatingPools;
}

/**
 * Auth.js prefixes the cookie with `__Secure-` when it is issued over https.
 * Both names are accepted so the same build works in dev and production.
 */
const SESSION_COOKIE_NAMES = [
	"__Secure-authjs.session-token",
	"authjs.session-token",
	// Pre-v5 deployments, harmless to keep:
	"__Secure-next-auth.session-token",
	"next-auth.session-token",
];

const allowAnonymous = () => process.env.ALLOW_ANONYMOUS === "true";

let anonymousCounter = 0;

/** Called once at boot so a misconfigured deploy fails loudly. */
export function assertAuthConfigured(): void {
	if (!process.env.DATABASE_URL && !allowAnonymous()) {
		throw new Error(
			"DATABASE_URL is not set. The game server reads Auth.js sessions directly, " +
				"so it needs the same database as your Next.js app. " +
				"Set ALLOW_ANONYMOUS=true only for local experiments.",
		);
	}
}

/**
 * Authenticates a join request straight from the browser's cookies.
 *
 * The SDK sends matchmaking requests with `credentials: "include"`, so the
 * `authjs.session-token` cookie arrives here untouched — it never has to be
 * exposed to JavaScript, and there is no second token format to keep in sync.
 *
 * Requires the cookie to be in scope for this origin: in production that means
 * running the game server on a subdomain of the app and giving the cookie a
 * `domain` (see `auth.ts`). On localhost, cookies ignore the port, so :3000 and
 * :2567 already share them.
 */
export async function authenticate(
	context: AuthContext,
): Promise<AuthUser | null> {
	const token = readSessionToken(context) ?? stripBearer(context?.token);

	if (!token) return allowAnonymous() ? anonymousUser() : null;
	if (token.length > 255) return null;

	try {
		const rows = await db
			.select({
				id: users.id,
				username: users.username,
				name: users.name,
				country: users.country,
				flair: users.flair,
				image: users.image,
				gamesPlayed: users.gamesPlayed,
			})
			.from(sessions)
			.innerJoin(users, eq(users.id, sessions.userId))
			.where(
				and(
					eq(sessions.sessionToken, token),
					gt(sessions.expires, new Date()), // expired session === signed out
					isNull(users.bannedAt),
				),
			)
			.limit(1);

		const user = rows[0];
		if (!user) return null;

		return {
			ratings: await poolsFor(db, user.id),
			id: user.id,
			username: user.username,
			name: (user.name ?? user.username).slice(0, 40),
			country: user.country,
			flair: user.flair,
			// Bounded because it goes into the room state and out to both
			// clients; a pathological URL should not bloat every patch.
			image: user.image && user.image.length <= 255 ? user.image : null,
			// Placeholders, every one of them: a member has no single rating,
			// because every pool carries its own. `onJoin` replaces all three with
			// the pool the room's clock belongs to before anybody is seated.
			rating: DEFAULT_RATING,
			deviation: DEFAULT_DEVIATION,
			volatility: DEFAULT_VOLATILITY,
			gamesPlayed: user.gamesPlayed,
		};
	} catch (err) {
		// A database blip must read as "not authenticated", never as "allowed".
		console.error("[auth] session lookup failed", err);
		return null;
	}
}

function readSessionToken(context: AuthContext): string | null {
	const header = readCookieHeader(context);
	if (!header) return null;

	// `cookie` handles quoting and percent-decoding, and is the same parser
	// Next.js and Auth.js use — so what we read is exactly what was written.
	// (v2 renamed `parse` to `parseCookie`.)
	const jar = parseCookie(header);
	for (const name of SESSION_COOKIE_NAMES) {
		const value = jar[name];
		if (value) return value;
	}
	return null;
}

/** `context.headers` is a fetch `Headers` here, but stays tolerant of a plain object. */
function readCookieHeader(context: AuthContext): string | null {
	const headers = context?.headers as unknown;
	if (!headers) return null;

	if (typeof (headers as Headers).get === "function") {
		return (headers as Headers).get("cookie");
	}
	const value = (headers as Record<string, string | string[]>).cookie;
	return Array.isArray(value) ? value.join("; ") : (value ?? null);
}

function stripBearer(token?: string): string | null {
	const value = token?.replace(/^Bearer\s+/i, "").trim();
	return value ? value : null;
}

function anonymousUser(): AuthUser {
	anonymousCounter += 1;
	return {
		id: `anon-${anonymousCounter}-${Math.random().toString(36).slice(2, 8)}`,
		username: `guest-${anonymousCounter}`,
		name: `Guest ${anonymousCounter}`,
		country: null,
		flair: null,
		image: null,
		rating: DEFAULT_RATING,
		deviation: DEFAULT_DEVIATION,
		volatility: DEFAULT_VOLATILITY,
		gamesPlayed: 0,
		ratings: emptyPools(),
	};
}
