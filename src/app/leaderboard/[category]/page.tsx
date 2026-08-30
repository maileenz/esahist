import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import JsonLd from "@/components/json-ld";
import StandingsTable from "@/components/leaderboard/standings-table";
import { toCountryCode } from "@/lib/countries";
import {
	breadcrumbs,
	canonical,
	openGraphFor,
	SITE_NAME,
	twitterFor,
} from "@/lib/seo";
import { isRatingCategory } from "@/lib/timeControls";
import { api, HydrateClient } from "@/trpc/server";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ category: string }>;
}): Promise<Metadata> {
	const { category } = await params;
	const t = await getTranslations("leaderboard");

	/*
	 * Nothing to describe: the page below calls `notFound()`, and this metadata
	 * is what the 404 is served with. Claiming a title, a canonical or a card for
	 * an address that does not exist is a small lie that also puts whatever was
	 * typed into the URL onto the tab. Returning nothing falls back to the site
	 * name in the root layout, which is the truth.
	 */
	/*
	 * This still inherits the leaderboard layout's title and canonical, which is
	 * as far as Next lets a page opt out — `alternates: { canonical: null }` does
	 * not override an inherited one. It is left alone rather than worked around:
	 * the response is a 404, and a canonical on a 404 is not a signal any crawler
	 * acts on.
	 */
	if (!isRatingCategory(category)) return {};

	const categories = await getTranslations("categories");
	const locale = await getLocale();
	const title = t("categoryMetaTitle", { category: categories(category) });
	const description = t("categoryMetaDescription", {
		category: categories(category),
	});

	return {
		title,
		description,
		/*
		 * Same table, filtered: `?country=` is not a separate page. This matters
		 * more here than anywhere else on the site — every flag in the picker is a
		 * URL, so without a canonical one pool becomes two hundred near-identical
		 * pages competing with each other.
		 */
		alternates: canonical(`/leaderboard/${category}`),
		openGraph: openGraphFor({
			description,
			locale,
			title,
			url: `/leaderboard/${category}`,
		}),
		twitter: twitterFor({ description, title }),
	};
}

export default async function CategoryLeaderboardPage({
	params,
	searchParams,
}: {
	params: Promise<{ category: string }>;
	searchParams: Promise<{ country?: string }>;
}) {
	const { category } = await params;

	// The whitelist is the route: anything else is not a pool that exists.
	if (!isRatingCategory(category)) notFound();

	// An unknown code reads as global rather than as a filter that matches
	// nothing. It has to be normalised the same way on both sides or the
	// prefetched page and the client's first query are different cache entries.
	const country = toCountryCode((await searchParams).country);

	void api.leaderboard.standings.prefetchInfinite({ category, country });

	const t = await getTranslations("leaderboard");
	const categories = await getTranslations("categories");

	return (
		<HydrateClient>
			{/*
			 * Home › Leaderboard › Blitz, which is what Google prints above the
			 * result instead of the raw URL. Built from the same strings the page
			 * is titled with, so the trail cannot say something the page does not.
			 */}
			<JsonLd
				data={breadcrumbs([
					{ name: SITE_NAME, path: "/" },
					{ name: t("title"), path: "/leaderboard" },
					{ name: categories(category), path: `/leaderboard/${category}` },
				])}
			/>
			<StandingsTable category={category} country={country} />
		</HydrateClient>
	);
}
