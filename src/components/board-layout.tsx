/**
 * The shape every board page has: a board on the left, a panel on the right.
 *
 * Only this row is height-constrained. The board sizes itself from the viewport
 * height rather than the page growing to fit it, and the panel scrolls inside
 * that same height — so a ninety-move game does not push the board off the top
 * of the screen. Below `lg` the two simply stack.
 */
export function BoardLayout({
	board,
	panel,
}: {
	board: React.ReactNode;
	panel: React.ReactNode;
}) {
	return (
		<main className="flex flex-col gap-4 p-3 lg:h-screen lg:flex-row lg:justify-center lg:overflow-hidden">
			<div className="min-w-0 lg:flex lg:max-w-220 lg:flex-1">{board}</div>

			{/* The board owns the height, so a long move list scrolls inside the
			    panel rather than pushing the page taller than the screen. */}
			<div className="w-full shrink-0 lg:h-full lg:w-[400px] lg:overflow-y-auto">
				{panel}
			</div>
		</main>
	);
}

/**
 * How much of the column is *not* the board: the two seats, the gaps between
 * them, and the page padding. The board is square, so its height caps its
 * width — without subtracting this it grows taller than the screen and the
 * bottom seat drifts off the bottom.
 *
 * `svh` rather than `vh`: on phones `vh` is the large viewport, so the bottom
 * seat would hide under the browser toolbar.
 */
const CHROME = "8rem";

/**
 * A board with a seat above and below it.
 *
 * `footer` is for anything that sits under the bottom seat and therefore has to
 * come out of the board's height too — the replay's step controls. Pass the
 * space it needs as `chrome`, since only the caller knows how tall its own
 * footer is.
 */
export function BoardColumn({
	top,
	bottom,
	children,
	notice,
	footer,
	chrome = CHROME,
}: {
	top: React.ReactNode;
	bottom: React.ReactNode;
	children: React.ReactNode;
	notice?: string | null;
	footer?: React.ReactNode;
	/** Height taken by everything that is not the board. */
	chrome?: string;
}) {
	return (
		<div
			className="mx-auto flex w-full flex-col gap-2 lg:w-[min(100%,calc(100svh-var(--board-chrome)))]"
			style={{ "--board-chrome": chrome } as React.CSSProperties}
		>
			{top}

			<div className="relative aspect-square w-full">
				{children}

				{/* Overlaid rather than stacked: a transient warning must not change
				    the column's height and shrink the board under it. */}
				{notice && (
					<p className="absolute inset-x-3 bottom-3 rounded-lg bg-warning-soft px-3 py-2 text-center text-sm text-warning shadow-lg">
						{notice}
					</p>
				)}
			</div>

			{bottom}

			{footer}
		</div>
	);
}
