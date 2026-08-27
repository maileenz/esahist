import { CATEGORY_ICONS } from "@/components/category-icon";
import RatingSparkline from "@/components/member/rating-sparkline";
import {
	CATEGORY_META,
	TIME_CONTROL_CATEGORIES,
	type TimeControlCategory,
} from "@/lib/timeControls";
import type { RatingHistory } from "@/server/api/routers/member";
import type { RatingPools as Pools } from "@/server/db/ratings";

/**
 * A card per rating pool: what it is, where it stands, which way it has been
 * going, and the shape of the last month.
 *
 * The card itself stays a server component; only the chart inside it is
 * client-side, so four sparklines do not drag the whole strip into the
 * browser's hands.
 *
 * Only pools they have actually played. An unrated pool has nothing to report —
 * the starting rating is not a fact about the member, it is the same number
 * everyone begins with — and four cards of it says less than one card of a real
 * rating. A member with no rated games at all gets no strip: there is a Games
 * tab a click away that already says they have not played.
 */
export default function RatingPools({
	ratings,
	history,
}: {
	ratings: Pools;
	/** A month of daily ratings per pool, oldest first. */
	history?: RatingHistory;
}) {
	const played = TIME_CONTROL_CATEGORIES.filter(
		(category) => ratings[category].established,
	);

	if (played.length === 0) return null;

	return (
		// Wrapping flex rather than a fixed grid: the number of pools is whatever
		// `TIME_CONTROL_CATEGORIES` says it is today, and a `grid-cols-4` left a
		// hole the day classical was retired. Cards share the row evenly and the
		// last one on a wrapped row stretches, so there is never a gap.
		<section className="flex flex-wrap gap-3">
			{played.map((category) => (
				<RatingCard
					category={category}
					key={category}
					points={history?.[category] ?? []}
					pool={ratings[category]}
				/>
			))}
		</section>
	);
}

function RatingCard({
	category,
	pool,
	points,
}: {
	category: TimeControlCategory;
	pool: Pools[TimeControlCategory];
	points: RatingHistory[TimeControlCategory];
}) {
	const Icon = CATEGORY_ICONS[category];
	// Measured across the window the chart draws, so the arrow and the line
	// agree about what "lately" means.
	const first = points[0]?.rating;
	const last = points.at(-1)?.rating;
	const change = first !== undefined && last !== undefined ? last - first : 0;

	return (
		<div
			className="flex min-w-40 flex-1 flex-col rounded-xl border border-line bg-surface p-3 shadow-sm"
			// ±RD is how sure Glicko-2 is of that number: wide after a couple of
			// games, narrow once somebody has a record.
			title={`± ${Math.round(pool.deviation)} · peak ${pool.peakRating} · ${
				pool.gamesPlayed
			} ${pool.gamesPlayed === 1 ? "game" : "games"}`}
		>
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0">
					<p className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">
						<Icon aria-hidden className="h-3.5 w-3.5 shrink-0" />
						{CATEGORY_META[category].label}
					</p>
					{/* Proportional figures, not tabular: these sit side by side rather
					    than in a column, and equal-width digits only pay off when
					    numbers line up vertically. */}
					<p className="font-bold text-2xl text-fg">{pool.rating}</p>
				</div>

				{change !== 0 && (
					<span
						className={`shrink-0 font-semibold text-xs tabular-nums ${
							change > 0 ? "text-primary" : "text-danger"
						}`}
						title={`${change > 0 ? "Up" : "Down"} ${Math.abs(
							change,
						)} over the last ${points.length} days`}
					>
						{change > 0 ? "↑" : "↓"}
						{Math.abs(change)}
					</span>
				)}
			</div>

			<RatingSparkline points={points} up={change >= 0} />
		</div>
	);
}
