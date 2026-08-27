"use client";

import { useTranslations } from "next-intl";
import InfiniteLoader from "@/components/ui/infinite-loader";
import { api } from "@/trpc/react";
import GameListItem, { GameListHeader } from "./game-list-item";

/**
 * The games tab: one long list that grows as you reach the bottom.
 *
 * The input here must match the page's `prefetchInfinite` exactly, or the query
 * key differs, the hydrated entry is ignored and this suspends on a fetch it
 * did not need to make.
 */
export default function GameHistoryList({ username }: { username: string }) {
	const t = useTranslations("game");
	const [data, pager] = api.member.games.useSuspenseInfiniteQuery(
		{ username },
		{ getNextPageParam: (page) => page.nextCursor },
	);

	const games = data.pages.flatMap((page) => page.items);

	if (games.length === 0) {
		return (
			<p className="rounded-xl border border-line bg-surface p-5 text-muted-foreground text-sm shadow-sm">
				{t("noGames")}
			</p>
		);
	}

	return (
		<div>
			<div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
				<GameListHeader />
				<ul>
					{games.map((game) => (
						<GameListItem game={game} key={game.id} />
					))}
				</ul>
			</div>

			<InfiniteLoader endMessage={t("everyGame")} query={pager} />
		</div>
	);
}
