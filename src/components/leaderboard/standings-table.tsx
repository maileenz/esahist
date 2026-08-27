"use client";

import { useTranslations } from "next-intl";
import InfiniteLoader from "@/components/ui/infinite-loader";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { TimeControlCategory } from "@/lib/timeControls";
import { api } from "@/trpc/react";
import { Place, Player } from "./bits";

/**
 * One pool's whole table: rank, player, rating, and their record *in that
 * pool* — a bullet record next to a bullet rating, which is the only pairing
 * that means anything once the ratings are separate.
 */
export default function StandingsTable({
	category,
	country,
}: {
	category: TimeControlCategory;
	/** Already narrowed by the page; must match its prefetch exactly. */
	country: string | null;
}) {
	const t = useTranslations("leaderboard");
	const [data, pager] = api.leaderboard.standings.useSuspenseInfiniteQuery(
		{ category, country },
		{ getNextPageParam: (page) => page.nextCursor },
	);

	const rows = data.pages.flatMap((page) => page.items);

	if (rows.length === 0) {
		return (
			<p className="rounded-xl border border-line bg-surface p-6 text-center text-muted-foreground text-sm shadow-sm">
				{country ? t("emptyHere") : t("empty")}
			</p>
		);
	}

	return (
		<div>
			{/* A real table: rank, rating and record are columns, and a screen
			    reader should be able to say so. The record columns fold away on a
			    phone, where the rating is the only number with room. */}
			<div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
				<Table>
					<TableHeader>
						<TableRow className="bg-elevated hover:bg-elevated">
							<TableHead className="w-7" />
							<TableHead>{t("player")}</TableHead>
							<TableHead className="w-16 text-right">{t("rating")}</TableHead>
							<TableHead className="hidden w-12 text-right sm:table-cell">
								Won
							</TableHead>
							<TableHead className="hidden w-12 text-right sm:table-cell">
								Draw
							</TableHead>
							<TableHead className="hidden w-12 text-right sm:table-cell">
								Lost
							</TableHead>
						</TableRow>
					</TableHeader>

					<TableBody>
						{rows.map((row) => (
							<TableRow className="odd:bg-elevated/40" key={row.username}>
								<TableCell>
									<Place place={row.place} />
								</TableCell>
								<TableCell className="min-w-0">
									<Player player={row} />
								</TableCell>
								<TableCell
									className="text-right font-bold text-fg tabular-nums"
									title={`± ${Math.round(row.deviation)} over ${row.gamesPlayed} rated ${row.gamesPlayed === 1 ? "game" : "games"}`}
								>
									{row.rating}
								</TableCell>
								<TableCell className="hidden text-right text-primary tabular-nums sm:table-cell">
									{row.record.wins}
								</TableCell>
								<TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">
									{row.record.draws}
								</TableCell>
								<TableCell className="hidden text-right text-danger tabular-nums sm:table-cell">
									{row.record.losses}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>

			<InfiniteLoader query={pager} />
		</div>
	);
}
