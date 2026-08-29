import "server-only";

import type { Metadata } from "next";
import { env } from "@/env";
import { LOCALES } from "@/i18n/locales";
import en from "../../messages/en.json";
import { BRAND_FULL_NAME } from "./brand-mark";

/**
 * Everything the site says about itself to a machine.
 *
 * Kept in one file because the facts here are shared by things that never see
 * each other: `generateMetadata` in a dozen routes, `robots.ts`, `sitemap.ts`,
 * the web manifest and the Open Graph card. Spread across those, the origin in
 * particular would be wrong in one of them within a month.
 *
 * Server-only, and not by accident — `AUTH_URL` is a server variable, so a
 * client component importing this would fail validation at build.
 */

export const SITE_NAME = BRAND_FULL_NAME;

/**
 * The site's own address, scheme and all, without a trailing slash.
 *
 * `AUTH_URL` rather than a variable of its own. It is already defined as "where
 * the app is served… it must match what the browser sees, scheme included",
 * which is exactly what a canonical URL is, and it is already set on every
 * deployment because Auth.js builds its callback URLs from it. A second
 * variable saying the same thing is a second variable to get out of step, and
 * the failure would be silent: canonicals and sitemaps pointing at a host
 * nobody serves.
 *
 * Deliberately *not* `NEXT_PUBLIC_`. The Docker image is built once and run
 * against a domain; a public variable is inlined at build time, which is what
 * makes `NEXT_PUBLIC_GAME_SERVER_URL` domain-specific and forces a rebuild when
 * the domain changes. Read on the server, the same image serves any domain.
 */
export function siteOrigin(): string {
	// The localhost fallback is for `next build` without an env file and for
	// local runs. In production `AUTH_URL` is set, or sign-in is broken long
	// before anybody notices the sitemap.
	return (env.AUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

/** A site-relative path as the absolute URL a crawler or a scraper needs. */
export function absoluteUrl(path: string): string {
	return new URL(path, `${siteOrigin()}/`).toString();
}

/**
 * True only where the site is actually reachable under its real domain.
 *
 * Used to decide whether crawling is allowed at all: a staging box or a preview
 * container serves the same HTML as production, and the fastest way to lose the
 * real domain's rankings is to let a copy of it get indexed.
 */
export function isIndexableDeployment(): boolean {
	return env.NODE_ENV === "production" && Boolean(env.AUTH_URL);
}

/**
 * Everything behind the sign-in wall.
 *
 * A crawler that follows a link here is served the login page, and a login page
 * indexed under a dozen addresses is duplicate content pointing at nothing. The
 * routes are listed once and both `robots.ts` and the pages' own metadata read
 * the list, so a route cannot be disallowed in one and inviting in the other.
 *
 * `/api` is here for tidiness rather than safety — nothing under it renders a
 * page — and the two payment paths carry session-scoped query strings that have
 * no business in an index.
 */
export const PRIVATE_PATHS = [
	"/admin",
	"/api",
	"/friends",
	"/settings",
] as const;

/**
 * Keeps a page out of the index and out of anybody's snippet.
 *
 * `nocache` and the Google-specific pair are not redundant with `noindex`: they
 * are what stops a page that was already indexed from lingering as a cached
 * copy with a snippet after it goes private.
 */
export const NOINDEX: Metadata["robots"] = {
	index: false,
	follow: false,
	nocache: true,
	googleBot: { index: false, follow: false },
};

/**
 * The canonical address of a page, as metadata.
 *
 * Every route needs one and the reason is the query strings: `?tc=blitz`,
 * `?country=ro`, `?status=open`, `?callbackUrl=…` are all the same page as far
 * as a reader is concerned and all different URLs as far as a crawler is
 * concerned. Naming the canonical collapses them back into one.
 *
 * Relative on purpose — `metadataBase` in the root layout resolves it, so the
 * origin is decided in exactly one place.
 */
export function canonical(path: string): Metadata["alternates"] {
	return { canonical: path };
}

/**
 * What the site is, in the vocabulary a search engine parses.
 *
 * Two things rather than one, because they answer different questions.
 * `WebSite` is the address and what it is called — it is what a search result
 * shows as the site name instead of the bare domain. `WebApplication` is what
 * it does, and is what puts it in the game category rather than filed as a
 * document. They are linked by `@id` so a parser reads them as one subject.
 *
 * No `SearchAction`: that declares a public search endpoint, and this site has
 * none. Claiming one that answers with a redirect is worse than claiming
 * nothing.
 */
export function siteStructuredData(description: string, locale: string) {
	const origin = siteOrigin();

	return {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "WebSite",
				"@id": `${origin}/#website`,
				url: `${origin}/`,
				name: SITE_NAME,
				description,
				inLanguage: locale,
			},
			{
				"@type": "WebApplication",
				"@id": `${origin}/#app`,
				name: SITE_NAME,
				url: `${origin}/`,
				description,
				applicationCategory: "GameApplication",
				// The board runs in the page; there is nothing to install.
				operatingSystem: "Any",
				browserRequirements: "Requires JavaScript.",
				inLanguage: locale,
				isPartOf: { "@id": `${origin}/#website` },
				image: absoluteUrl("/opengraph-image"),
				/*
				 * Free to play, and said explicitly. An `offers` block with a price of
				 * zero is what stops the membership page being read as the price of
				 * the site — and a missing one is a common reason a rich result is
				 * dropped for an application.
				 */
				offers: {
					"@type": "Offer",
					price: "0",
					priceCurrency: "EUR",
				},
			},
		],
	};
}

/**
 * The social card's dimensions and its alt text, owned here rather than in the
 * route that draws it.
 *
 * `opengraph-image.tsx` reads them back for its own `size` and `alt` exports, so
 * there is one set of numbers. The alt is English because the card is: language
 * on this site is a cookie, and no scraper sends one.
 */
export const OG_IMAGE = {
	url: "/opengraph-image",
	width: 1200,
	height: 630,
	alt: `${SITE_NAME} — ${en.common.metaDescription}`,
} as const;

/**
 * A complete Open Graph block for one page.
 *
 * A helper rather than a field in the root layout, because Next replaces the
 * whole `openGraph` object when a child defines one — it does not merge them.
 * A route that set only its own `url` and `title` silently dropped the site
 * name, the type, the locale and the card image, which is precisely the bug
 * this exists to make impossible.
 *
 * The image is named explicitly for the same reason: the file convention's
 * automatic tag is part of what an override throws away.
 */
export function openGraphFor({
	description,
	locale,
	title,
	url,
}: {
	description: string;
	locale: string;
	title: string;
	url: string;
}): Metadata["openGraph"] {
	return {
		type: "website",
		siteName: SITE_NAME,
		title,
		description,
		url,
		images: [OG_IMAGE],
		/*
		 * Honest rather than useful: language here is a cookie, so a scraper —
		 * which sends none — always gets the negotiated default. The alternates are
		 * declared anyway so the tag is not a lie about a site that does speak
		 * both.
		 */
		locale,
		alternateLocale: LOCALES.filter((other) => other !== locale),
	};
}

/**
 * The Twitter card, which is the Open Graph block again in a second vocabulary.
 *
 * Twitter falls back to `og:` tags for anything it is not given, so this could
 * be omitted — but only the parts it shares. `summary_large_image` is not one
 * of them, and without it a card that was drawn at 1200×630 is cropped to a
 * thumbnail.
 */
export function twitterFor({
	description,
	title,
}: {
	description: string;
	title: string;
}): Metadata["twitter"] {
	return {
		card: "summary_large_image",
		title,
		description,
		images: [OG_IMAGE],
	};
}

/**
 * A breadcrumb trail, in the vocabulary Google renders above a search result.
 *
 * Worth the tags where a generic `ItemList` is not. Google supports breadcrumbs
 * as a rich result and shows the trail in place of the bare URL; a ranked list
 * of people, by contrast, is not one of the types it draws a carousel for, so
 * marking up the standings themselves would cost a query per page view and buy
 * nothing.
 *
 * The last crumb is the current page. It still carries its own URL, which is
 * what the spec asks for and what stops the trail being dropped as incomplete.
 */
export function breadcrumbs(
	trail: readonly { name: string; path: string }[],
): object {
	return {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: trail.map((crumb, index) => ({
			"@type": "ListItem",
			position: index + 1,
			name: crumb.name,
			item: absoluteUrl(crumb.path),
		})),
	};
}

/**
 * One member's profile, as a `ProfilePage` wrapping a `Person`.
 *
 * The type Google added for exactly this: a page whose subject is an account on
 * a site, rather than an article that happens to mention somebody. It is what
 * lets a result show the handle, the join date and a follower-style count
 * instead of a bare title.
 *
 * `alternateName` is the handle and `name` is the display name, which is the
 * way round the vocabulary defines them — and the display name is omitted when
 * it is the handle again, rather than repeated.
 *
 * Nothing here is a fact the page does not already show. That is the rule for
 * this whole function: structured data is a second copy of the page for
 * machines, not a place to publish more than the reader gets.
 */
export function profileStructuredData(member: {
	username: string;
	name: string | null;
	image: string | null;
	location: string | null;
	createdAt: Date | string;
	finishedGames: number;
	views: number;
}): object {
	const url = absoluteUrl(`/member/${encodeURIComponent(member.username)}`);

	return {
		"@context": "https://schema.org",
		"@type": "ProfilePage",
		"@id": url,
		url,
		dateCreated: new Date(member.createdAt).toISOString(),
		mainEntity: {
			"@type": "Person",
			"@id": `${url}#person`,
			alternateName: member.username,
			...(member.name && member.name !== member.username
				? { name: member.name }
				: { name: member.username }),
			...(member.image ? { image: member.image } : {}),
			...(member.location ? { homeLocation: member.location } : {}),
			url,
			interactionStatistic: [
				{
					"@type": "InteractionCounter",
					interactionType: "https://schema.org/PlayGameAction",
					userInteractionCount: member.finishedGames,
				},
				{
					"@type": "InteractionCounter",
					interactionType: "https://schema.org/ViewAction",
					userInteractionCount: member.views,
				},
			],
		},
	};
}
