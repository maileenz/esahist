import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import GameListItem, {
	GameListHeader,
} from "@/components/member/game-list-item";
import RatingPools from "@/components/member/rating-pools";
import { memberProfile } from "@/trpc/cached";
import { api } from "@/trpc/server";

/** How many games the overview shows before handing off to the Games tab. */
const RECENT = 8;

/**
 * The overview: every rating, then the last handful of games.
 *
 * Deliberately not the full archive — that is what the Games tab is for, and
 * "See more" goes straight there. This page is the answer to "who is this
 * player", which is four numbers and a glance at what they have been playing.
 */
export default async function MemberOverviewPage({
	params,
}: {
	params: Promise<{ username: string }>;
}) {
	const common = await getTranslations("common");
	const t = await getTranslations("game");
	const { username } = await params;
	const handle = decodeURIComponent(username).toLowerCase();

	// The layout has already resolved the member and 404ed an unknown one, so
	// by here these are all guaranteed to land. No session is needed: all three
	// procedures are public, the same as the profile itself.
	const [member, history, recent] = await Promise.all([
		// Already resolved by the layout; `memberProfile` is what stops that being
		// a second trip to the database.
		memberProfile(handle),
		api.member.ratingHistory({ username: handle }),
		api.member.games({ username: handle, limit: RECENT }),
	]);

	if (!member) notFound();

	return (
		<div className="flex flex-col gap-4">
			<RatingPools history={history} ratings={member.ratings} />

			<section className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
				<h2 className="px-4 py-3 font-bold text-fg text-lg">
					Game History{" "}
					<span className="font-semibold text-muted-foreground text-sm tabular-nums">
						({member.finishedGames})
					</span>
				</h2>

				{recent.items.length === 0 ? (
					<p className="border-line border-t px-4 py-6 text-center text-muted-foreground text-sm">
						{t("noGames")}
					</p>
				) : (
					<>
						<GameListHeader />
						<ul>
							{recent.items.map((game) => (
								<GameListItem game={game} key={game.id} />
							))}
						</ul>

						{member.finishedGames > recent.items.length && (
							<Link
								className="flex items-center justify-center gap-1 border-line border-t px-4 py-3 font-semibold text-muted-foreground text-sm transition hover:bg-elevated hover:text-fg"
								href={`/member/${member.username}/games`}
							>
								{common("seeMore")}
								<ChevronRight aria-hidden className="h-4 w-4" />
							</Link>
						)}
					</>
				)}
			</section>
		</div>
	);
}
