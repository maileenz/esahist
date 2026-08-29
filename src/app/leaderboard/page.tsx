import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { CATEGORY_ICONS } from "@/components/category-icon";
import JsonLd from "@/components/json-ld";
import {
	type LeaderboardPlayer,
	Place,
	Player,
} from "@/components/leaderboard/bits";
import { toCountryCode } from "@/lib/countries";
import { breadcrumbs, SITE_NAME } from "@/lib/seo";
import { api } from "@/trpc/server";

/**
 * The top of every pool at once: one card per rating, the leaders in it, and a
 * way through to the whole table.
 */
export default async function LeaderboardPage({
	searchParams,
}: {
	searchParams: Promise<{ country?: string }>;
}) {
	const common = await getTranslations("common");
	const t = await getTranslations("leaderboard");
	const categories = await getTranslations("categories");
	// An unknown code reads as global rather than as a filter that matches
	// nothing, which is what a hand-edited URL would otherwise produce.
	const country = toCountryCode((await searchParams).country);
	const boards = await api.leaderboard.overview({ country });

	return (
		<div className="flex flex-col gap-4">
			{/* Home › Leaderboard. The pool pages add their own third crumb. */}
			<JsonLd
				data={breadcrumbs([
					{ name: SITE_NAME, path: "/" },
					{ name: t("title"), path: "/leaderboard" },
				])}
			/>

			{boards.map(({ category, players }) => {
				const Icon = CATEGORY_ICONS[category];

				return (
					<section
						className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm"
						key={category}
					>
						<div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-6">
							{/* The pool's name sits beside its standings rather than above
							    them, which is what keeps four boards on one screen. */}
							<div className="flex shrink-0 items-center gap-3 sm:w-36 sm:flex-col sm:justify-center sm:gap-1">
								<Icon
									aria-hidden
									className="h-7 w-7 text-primary sm:h-9 sm:w-9"
								/>
								<span className="font-bold text-fg text-lg">
									{categories(category)}
								</span>
							</div>

							{players.length === 0 ? (
								<p className="flex-1 py-4 text-center text-muted-foreground text-sm">
									{country
										? t("emptyCategoryHere", { category: categories(category) })
										: t("emptyCategory", { category: categories(category) })}
								</p>
							) : (
								<ol className="min-w-0 flex-1">
									{players.map((player) => (
										<li
											className="flex items-center gap-3 border-line border-b py-1.5 last:border-b-0"
											key={player.username}
										>
											<Place place={player.place} />
											<Player player={player as LeaderboardPlayer} />
											<span className="shrink-0 font-semibold text-fg text-sm tabular-nums">
												{player.rating}
											</span>
										</li>
									))}
								</ol>
							)}
						</div>

						{players.length > 0 && (
							<Link
								className="flex items-center justify-center gap-1 border-line border-t px-4 py-3 font-semibold text-muted-foreground text-sm transition hover:bg-elevated hover:text-fg"
								href={`/leaderboard/${category}${country ? `?country=${country}` : ""}`}
							>
								{common("seeAll")}
								<ChevronRight aria-hidden className="h-4 w-4" />
							</Link>
						)}
					</section>
				);
			})}
		</div>
	);
}
