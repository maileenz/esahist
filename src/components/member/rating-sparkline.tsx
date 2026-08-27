"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";

import type { TimeControlCategory } from "@/lib/timeControls";
import type { RatingHistory } from "@/server/api/routers/member";

/** How much of the chart's height is left empty above and below the run. */
const GUTTER = 0.25;

/**
 * A month of a rating pool, a point a day.
 *
 * Drawn over its own range rather than an absolute scale — a month that moved
 * thirty rating points would otherwise draw as a flat line, and the shape is
 * what this is for. No axis and no labels: the number above it is the fact,
 * this is the direction. Hovering reads off the rating on that day.
 */
export default function RatingSparkline({
	points,
	up,
}: {
	/** One point per day, oldest first — see `member.ratingHistory`. */
	points: RatingHistory[TimeControlCategory];
	up: boolean;
}) {
	// A month always has days in it, so there is always a line to draw: flat for
	// somebody who has not played the pool, which reads as "nothing happened"
	// rather than as an empty box.
	if (points.length === 0) return <div aria-hidden className="h-20" />;

	const ratings = points.map((point) => point.rating);
	const low = Math.min(...ratings);
	const high = Math.max(...ratings);

	// Room above and below the run, proportional to how far it travelled: a
	// fixed pad would be invisible on a swing of two hundred and the whole box
	// on a swing of five. Without it the peaks are drawn on the edge of the
	// viewport and the stroke is cut in half.
	//
	// `GUTTER` is a share of the *drawn box*, not of the data. Padding by 25% of
	// the span would only leave a fifth of the box, because the padding grows
	// the box it is then measured against — so solve `pad / (span + 2 * pad)`
	// for the gutter actually wanted and the curve sits properly in the middle.
	const pad = Math.max(2, ((high - low) * GUTTER) / (1 - 2 * GUTTER));
	const tone = up ? "var(--color-brand)" : "var(--color-danger)";

	return (
		<div aria-hidden className="h-20 w-full">
			<ResponsiveContainer height="100%" width="100%">
				{/* The margin is what keeps the line inside the picture: recharts
				    draws the first and last points *on* the plot edge, so half of a
				    1.5px stroke — and all of a hovered dot — falls outside it. */}
				<AreaChart
					// Recharts' keyboard layer puts `tabindex=0` on the svg, which
					// inside an `aria-hidden` container is a tab stop screen readers
					// cannot describe. This chart is decorative — the rating and its
					// change are written above it — so it should not be one.
					accessibilityLayer={false}
					data={points}
					margin={{ bottom: 3, left: 4, right: 4, top: 4 }}
				>
					<YAxis domain={[low - pad, high + pad]} hide />

					{/* No cursor line: the dot on the curve already says which day is
					    being read, and a rule through a sparkline this short is more
					    ink than information. */}
					<Tooltip
						content={<Bubble />}
						cursor={false}
						isAnimationActive={false}
					/>

					<Area
						activeDot={{ r: 3, stroke: "var(--color-surface)", strokeWidth: 1 }}
						dataKey="rating"
						dot={false}
						fill={tone}
						fillOpacity={0.14}
						isAnimationActive={false}
						stroke={tone}
						strokeWidth={1.5}
						type="monotone"
					/>
				</AreaChart>
			</ResponsiveContainer>
		</div>
	);
}

/**
 * Recharts' own tooltip is a white box with inline styles; this one is painted
 * with the site's tokens so it survives all four themes.
 *
 * The rating alone. The card already says which pool this is and the axis is a
 * month either way — a date on every hover would be labelling the thing the
 * reader is pointing at.
 */
function Bubble({
	active,
	payload,
}: {
	active?: boolean;
	payload?: { payload: { rating: number } }[];
}) {
	const point = payload?.[0]?.payload;
	if (!active || !point) return null;

	return (
		<div className="rounded-lg border border-line bg-surface px-2 py-1 font-semibold text-fg text-xs shadow-lg">
			{point.rating}
		</div>
	);
}
