"use client";

import { Client, type Room } from "@colyseus/sdk";

import { env } from "@/env";
import type { ChessStateSnapshot } from "./chessTypes";

let client: Client | null = null;

/**
 * Where the browser reaches the game server.
 *
 * The room authenticates with the Auth.js session cookie, and that cookie is
 * host-only unless `AUTH_COOKIE_DOMAIN` is set — so it is sent to the host it
 * was issued on and nowhere else. Point the browser at a game server on a
 * *different* host and the join arrives with no cookie at all: `onAuth` finds
 * no session, and with `ALLOW_ANONYMOUS` on you are seated as "Guest 4" instead
 * of yourself.
 *
 * In development that is a footgun rather than a decision — the game server is
 * the same machine as the app, so the host that matters is whichever one you
 * happen to be browsing on: `localhost` from this machine, the LAN address from
 * a phone. The port and protocol come from the configured URL; the host follows
 * the page, so the cookie is always in scope.
 *
 * Production uses the configured value untouched. There the game server is a
 * subdomain of the app and the cookie carries an explicit domain, which is what
 * puts it in scope across both.
 */
function endpoint(): string {
	const configured = env.NEXT_PUBLIC_GAME_SERVER_URL;
	if (typeof window === "undefined") return configured;
	if (process.env.NODE_ENV === "production") return configured;

	const url = new URL(configured);
	if (url.hostname === window.location.hostname) return configured;

	const corrected = new URL(configured);
	corrected.hostname = window.location.hostname;
	console.warn(
		`[game] NEXT_PUBLIC_GAME_SERVER_URL is ${url.origin}, but this page is on ` +
			`${window.location.origin}. The session cookie is host-only, so it would ` +
			`not be sent there and you would join as a guest. Using ` +
			`${corrected.origin} instead.`,
	);
	return corrected.origin;
}

/** One SDK client per browser tab. Safe to call during render. */
export function getGameClient(): Client {
	if (!client) client = new Client(endpoint());
	return client;
}

const RATING_BUCKET_SIZE = 200;

/** Must match `ratingBucketOf` on the server or every join is rejected. */
function ratingBucketOf(rating: number): number {
	const clamped = Math.max(400, Math.min(3200, Math.round(rating)));
	return Math.floor(clamped / RATING_BUCKET_SIZE);
}

export interface MatchmakeOptions {
	timeControl: string;
	ranked: boolean;
	rating: number;
	/** How many neighbouring rating buckets to search before opening a new room. */
	spread?: number;
}

/**
 * `joinOrCreate` alone would strand players one bucket apart in separate rooms,
 * because the matchmaker only pairs exact option matches. So: try to *join* an
 * existing room in your bucket, then widen outwards, and only create a room of
 * your own once nothing is waiting.
 */
export async function matchmake(
	client: Client,
	{ timeControl, ranked, rating, spread = 1 }: MatchmakeOptions,
): Promise<Room<ChessStateSnapshot>> {
	const bucket = ratingBucketOf(rating);
	const options = (ratingBucket: number) => ({
		timeControl,
		ranked,
		ratingBucket,
	});

	const order = [bucket];
	for (let offset = 1; offset <= spread; offset++) {
		order.push(bucket - offset, bucket + offset);
	}

	for (const candidate of order) {
		if (candidate < 0) continue;
		try {
			// `join`, not `joinOrCreate`: creating here would return on the first
			// pass and the widening below would never happen.
			return (await client.join(
				"chess",
				options(candidate),
			)) as Room<ChessStateSnapshot>;
		} catch {
			// Nothing waiting in that bucket — or the room turned us away, which
			// is what a block looks like from here. Either way, keep widening.
		}
	}

	try {
		return (await client.joinOrCreate(
			"chess",
			options(bucket),
		)) as Room<ChessStateSnapshot>;
	} catch {
		// The one room in our band would not seat us. `create` always opens a
		// fresh one, so a block cannot leave anybody unable to start a game.
		return (await client.create(
			"chess",
			options(bucket),
		)) as Room<ChessStateSnapshot>;
	}
}

const STORAGE_KEY = "chess:reconnection";

export function rememberSession(
	roomId: string,
	reconnectionToken: string,
): void {
	try {
		sessionStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({ roomId, reconnectionToken, at: Date.now() }),
		);
	} catch {
		/* private browsing */
	}
}

export function forgetSession(): void {
	try {
		sessionStorage.removeItem(STORAGE_KEY);
	} catch {
		/* ignore */
	}
}

/**
 * Survives a page refresh (the SDK's automatic reconnection only covers a
 * dropped socket on a live page). The server holds the seat for 60s.
 */
export async function resumeSession(
	client: Client,
): Promise<Room<ChessStateSnapshot> | null> {
	let cached: { reconnectionToken?: string; at?: number } | null = null;
	try {
		cached = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
	} catch {
		cached = null;
	}
	if (!cached?.reconnectionToken) return null;
	if (Date.now() - (cached.at ?? 0) > 60_000) {
		forgetSession();
		return null;
	}

	try {
		return (await client.reconnect(
			cached.reconnectionToken,
		)) as Room<ChessStateSnapshot>;
	} catch {
		forgetSession();
		return null;
	}
}
