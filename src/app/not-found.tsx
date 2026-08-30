import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { buttonVariants } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

/** How many squares across the little board is. */
const FILES = 4;

/** Which square is missing — the one the page is named after. */
const GAP = { file: 2, rank: 1 };

/**
 * A corner of a board with one square knocked out of it.
 *
 * The site's own squares, not a picture of some: the colours come from
 * `--board-light` and `--board-dark`, the same variables the real board reads
 * off `[data-board]`, so this follows whichever board theme the reader has
 * chosen and changes with it. That is the whole reason it is built from divs
 * rather than dropped in as an icon.
 *
 * The gap is painted in the page's own surface colour rather than left
 * transparent, so it reads as a hole in the board rather than a translucent
 * square, and it is ringed in the brand green because it is the one thing on
 * the page worth looking at.
 */
function BoardWithAGap() {
	return (
		<div
			aria-hidden
			className="grid overflow-hidden rounded-lg shadow-sm"
			style={{ gridTemplateColumns: `repeat(${FILES}, 2.75rem)` }}
		>
			{Array.from({ length: FILES * FILES }, (_, index) => {
				const file = index % FILES;
				const rank = Math.floor(index / FILES);
				const missing = file === GAP.file && rank === GAP.rank;

				return (
					<div
						className={cn(
							"aspect-square",
							missing &&
								"relative rounded-[3px] ring-2 ring-primary ring-inset",
						)}
						key={`${file}-${rank}`}
						style={{
							backgroundColor: missing
								? "var(--color-surface)"
								: (file + rank) % 2 === 0
									? "var(--board-light)"
									: "var(--board-dark)",
						}}
					/>
				);
			})}
		</div>
	);
}

/**
 * The page for an address that is not a page.
 *
 * Catches both halves of the same thing: a URL that matches no route at all,
 * and a route that ran and called `notFound()` — an unknown handle, a pool that
 * is not a pool, a game id that belongs to nobody. Before this they all got
 * Next's built-in black-on-white "404 | This page could not be found", which
 * shares no font, no colour and no way back with the rest of the site.
 *
 * Dressed like every other page here rather than like a component's empty
 * state: a solid `border-line bg-surface` card with a shadow, a heading at the
 * same size and weight the leaderboard and settings use, and the board itself
 * as the illustration. The `Empty` primitive is still doing the layout — it is
 * only the dashed border and the small muted type that have been overridden,
 * because those belong to an empty list inside a page, not to a page.
 *
 * Rendered inside the root layout, so the rail comes with it and there is
 * always a way out — which matters more here than anywhere else, because
 * getting here means the reader's last idea about where they were was wrong.
 * Both links are public, so they work signed in or not.
 */
export default async function NotFound() {
	const t = await getTranslations("notFound");
	const nav = await getTranslations("nav");

	return (
		<main className="mx-auto flex w-full max-w-2xl items-center p-4 lg:min-h-screen">
			{/*
			 * `border-solid` is not redundant: `Empty` ships `border-dashed` in its
			 * base classes, and a dashed outline is the look of a placeholder
			 * inside a page rather than of a page. Every other card on the site is
			 * a solid hairline, so this one is too.
			 */}
			<Empty className="gap-6 rounded-xl border border-line border-solid bg-surface p-8 shadow-sm sm:p-12">
				<EmptyHeader className="max-w-md gap-3">
					<EmptyMedia className="mb-2">
						<BoardWithAGap />
					</EmptyMedia>

					{/*
					 * A real `h1` inside the slot rather than instead of it: the slot
					 * renders a plain div and takes no `asChild`, so the heading is
					 * nested and inherits the type set here. Every other page has
					 * exactly one `h1`, and the page a crawler is most likely to reach
					 * by accident should not be the exception.
					 */}
					<EmptyTitle className="font-bold text-2xl text-fg tracking-tight">
						<h1>{t("title")}</h1>
					</EmptyTitle>

					<EmptyDescription className="text-base">
						{t("description")}
					</EmptyDescription>
				</EmptyHeader>

				<EmptyContent>
					<div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
						<Link className={cn(buttonVariants({ size: "lg" }))} href="/">
							{nav("play")}
						</Link>
						<Link
							className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
							href="/leaderboard"
						>
							{nav("leaderboard")}
						</Link>
					</div>
				</EmptyContent>
			</Empty>
		</main>
	);
}
