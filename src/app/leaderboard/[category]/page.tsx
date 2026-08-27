import type { Metadata } from "next";
import { notFound } from "next/navigation";

import StandingsTable from "@/components/leaderboard/standings-table";
import { toCountryCode } from "@/lib/countries";
import { CATEGORY_META, isRatingCategory } from "@/lib/timeControls";
import { api, HydrateClient } from "@/trpc/server";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ category: string }>;
}): Promise<Metadata> {
	const { category } = await params;
	if (!isRatingCategory(category))
		return { title: "Leaderboard · Grand Master" };

	return {
		title: `${CATEGORY_META[category].label} leaderboard · Grand Master`,
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

	return (
		<HydrateClient>
			<StandingsTable category={category} country={country} />
		</HydrateClient>
	);
}
