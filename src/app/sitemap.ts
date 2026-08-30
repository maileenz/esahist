import { and, desc, gt, isNull, ne } from "drizzle-orm";
import type { MetadataRoute } from "next";

import { absoluteUrl, isIndexableDeployment } from "@/lib/seo";
import { TIME_CONTROL_CATEGORIES } from "@/lib/timeControls";
import { db } from "@/server/db";
import { games, users } from "@/server/db/schema";

/**
 * How many profiles to offer.
 *
 * A sitemap may hold fifty thousand URLs, and this is well under it — the cap
 * is here so the file stays a fixed size as the site grows rather than becoming
 * a query that reads the whole members table. The busiest accounts go in, which
 * are the profiles worth finding.
 */
const PROFILE_LIMIT = 5000;

/**
 * How many games to offer.
 *
 * Deliberately smaller than the profile cap. Every game page is a board and a
 * move list, so at scale they are the thinnest thing this site publishes, and
 * submitting a hundred thousand of them is how a site gets read as bulk rather
 * than as content. The recent ones go in; the rest are still crawlable, and a
 * crawler that wants them will find them through the profiles that link to
 * them.
 */
const GAME_LIMIT = 2000;

/**
 * Resolved per request, not baked into the build.
 *
 * This is load-bearing rather than a performance choice. `next build` runs with
 * no server-side environment on purpose — the web image says so itself: "every
 * server-side value is read at run time" — so at build time `AUTH_URL` is
 * undefined. Prerendered, this file would ship as a blanket `Disallow: /` and a
 * sitemap of nothing, in production, with no error anywhere to say so. It would
 * also mean the image was domain-specific, which is the exact trap
 * `NEXT_PUBLIC_GAME_SERVER_URL` already documents.
 *
 * The cost is one render per request for a file fetched a handful of times a
 * day.
 */
export const dynamic = "force-dynamic";

/**
 * `/sitemap.xml` — the addresses worth offering a crawler.
 *
 * Only pages that render something to a signed-out visitor belong here. Listing
 * a page that answers with a redirect to `/login` is not a neutral act: it
 * spends crawl budget and teaches the crawler that this site's URLs do not mean
 * what they say.
 *
 * What that admits today: the home page, sign-in, the privacy policy, the
 * leaderboard overview and one page per rating pool, up to `PROFILE_LIMIT`
 * member profiles and up to `GAME_LIMIT` finished games. What it excludes, and
 * why: the friends inbox, settings and the moderation queue, because they
 * redirect; games still in progress and suspended accounts, because both carry
 * `noindex` and a sitemap that contradicts the page is an error Search Console
 * reports back.
 *
 * Each block below says what its own frequency and priority mean.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	if (!isIndexableDeployment()) return [];

	const now = new Date();

	/*
	 * Members with a game behind them, busiest first.
	 *
	 * `gamesPlayed > 0` is the whole filter, and it is doing real work: a profile
	 * with no games is a name, an empty rating table and nothing else, and
	 * submitting thousands of those is how a site teaches a crawler that its
	 * pages are not worth fetching.
	 *
	 * Suspended accounts are left out to agree with the `noindex` their pages
	 * carry — a sitemap that advertises a URL the page then refuses is a
	 * contradiction Search Console reports back as an error.
	 */
	const members = await db
		.select({ username: users.username, createdAt: users.createdAt })
		.from(users)
		.where(and(gt(users.gamesPlayed, 0), isNull(users.bannedAt)))
		.orderBy(desc(users.gamesPlayed))
		.limit(PROFILE_LIMIT);

	/*
	 * Finished games, newest first.
	 *
	 * `status != "playing"` matches the `noindex` a live game carries: a board
	 * that is still being played is a different page every minute, and a sitemap
	 * entry for one would be stale before it was fetched.
	 */
	const recentGames = await db
		.select({
			id: games.id,
			startedAt: games.startedAt,
			endedAt: games.endedAt,
		})
		.from(games)
		.where(ne(games.status, "playing"))
		.orderBy(desc(games.startedAt))
		.limit(GAME_LIMIT);

	return [
		{
			url: absoluteUrl("/"),
			lastModified: now,
			changeFrequency: "daily",
			priority: 1,
		},
		// Public today only because Auth.js sends people here; it is still the one
		// address a search result can usefully land on.
		{
			url: absoluteUrl("/login"),
			lastModified: now,
			changeFrequency: "monthly",
			priority: 0.5,
		},

		/*
		 * Reachable without a session and rarely changing, which is exactly what a
		 * sign-in provider's reviewer checks for — Google's consent screen asks for
		 * both of these URLs and fetches them. Low priority, since nobody searches
		 * for them, but they must be crawlable, so they are declared rather than
		 * left to be found through a link.
		 */
		{
			url: absoluteUrl("/privacy-policy"),
			lastModified: now,
			changeFrequency: "yearly",
			priority: 0.3,
		},
		{
			url: absoluteUrl("/terms-of-service"),
			lastModified: now,
			changeFrequency: "yearly",
			priority: 0.3,
		},

		/*
		 * The overview, and then one page per pool.
		 *
		 * Highest priority after the home page: these are the pages with content a
		 * stranger can read, and the only ones a search result can usefully land
		 * on. `daily` is honest — a rating moves every time somebody finishes a
		 * game.
		 *
		 * Enumerated from the same constant `isRatingCategory` validates against,
		 * so the sitemap cannot advertise a pool that 404s.
		 */
		{
			url: absoluteUrl("/leaderboard"),
			lastModified: now,
			changeFrequency: "daily",
			priority: 0.9,
		},
		...TIME_CONTROL_CATEGORIES.map((category) => ({
			url: absoluteUrl(`/leaderboard/${category}`),
			lastModified: now,
			changeFrequency: "daily" as const,
			priority: 0.8,
		})),

		/*
		 * One entry per member. `weekly` rather than `daily`: a profile changes
		 * when its owner plays, which for most accounts is not every day, and a
		 * frequency a site does not live up to is one a crawler learns to ignore.
		 */
		...members.map((member) => ({
			url: absoluteUrl(`/member/${encodeURIComponent(member.username)}`),
			lastModified: member.createdAt ?? now,
			changeFrequency: "weekly" as const,
			priority: 0.6,
		})),

		/*
		 * Recent games. `never` is the honest frequency and a useful one: a
		 * finished game is immutable, so a crawler that has seen one never needs
		 * to fetch it again, and saying so spends the budget on the boards that do
		 * change.
		 */
		...recentGames.map((game) => ({
			url: absoluteUrl(`/game/${encodeURIComponent(game.id)}`),
			lastModified: game.endedAt ?? game.startedAt ?? now,
			changeFrequency: "never" as const,
			priority: 0.4,
		})),
	];
}
