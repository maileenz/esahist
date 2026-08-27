"use client";

import { PieceIcon } from "@/components/chess-pieces";
import { useBoard } from "@/components/theme/theme-provider";
import { cn } from "@/lib/utils";

/**
 * Value order — the order a player expects to read a captured strip in, and
 * the same order `capturedFrom` hands them over in.
 */
const ORDER = ["p", "n", "b", "r", "q"] as const;

/**
 * How far each piece slides over the one behind it.
 *
 * Not a round number, because the thing being overlapped is not the box: every
 * set draws inside a 45-unit viewBox with the glyph floating in the middle of
 * it, so a 16px pawn is 7.5–9.6px of ink with 3.2–4.3px of nothing on either
 * side (measured across every set, widest to narrowest: forge, origami,
 * marble, walnut, bauhaus, ink). A one-step negative margin spends itself
 * entirely on that padding and still leaves the pawns 2.4–4.5px *apart* — the
 * strip looks like a row, not a stack.
 *
 * 10px clears both gutters and takes 1.5–3.6px out of the ink itself, which is
 * a fifth to a third of a pawn: enough to read as stacked at every set's
 * proportions, not so much that the shape behind is swallowed.
 */
const OVERLAP = "-space-x-2.5";

/**
 * Flat silhouettes, not the set's own colours.
 *
 * A piece is painted to be legible on a *board*, and the strip is not a board —
 * it is the page. Half of the 56 set-and-theme combinations put a piece on a
 * background of its own value: marble's white is 1.07 against Parchment, forge's
 * black is 1.49 against Dark. There is no palette that fixes that, because the
 * page has four backgrounds and each set has two fixed colours.
 *
 * So the strip stops asking. `brightness(0)` flattens whatever the set drew to
 * a solid shape and `--captured-tone` lifts it to the grey that theme wants, so
 * every set reads the same and none of them can disappear. Nothing is lost:
 * every piece in one strip is the same colour anyway — they are all the
 * opponent's — and at 16px there was never enough room for a set's character.
 *
 * The `drop-shadow` is a 1px rim in the page colour on the left edge, the side
 * that laps over its neighbour. Without it, flat shapes of one colour merge
 * into a blob at exactly the overlap that makes them read as a stack.
 */
const PIECE =
	"size-4 shrink-0 [filter:brightness(0)_invert(var(--captured-tone))_drop-shadow(-1px_0_0_var(--color-canvas))]";

/**
 * What one side has taken, stacked by piece type.
 *
 * Pieces of a kind overlap; kinds are spaced apart. That is what makes six
 * pawns read as *six pawns* at a glance rather than as a row of shapes to be
 * counted — the eye picks up one clump per type and its size, which is the
 * question being asked ("am I up a piece?"), not an inventory.
 *
 * A type nobody has taken is not an empty slot, it is absent: the strip is a
 * summary, and a gap for something that never happened is noise.
 */
export function CapturedPieces({
	pieces,
	className,
}: {
	/** Piece codes, e.g. `["bp", "bp", "bn"]`. Order does not matter. */
	pieces: string[];
	className?: string;
}) {
	// The strip is pieces, so it follows the member's set like the board does.
	const { pieceSet } = useBoard();

	const groups = ORDER.map((type) => ({
		type,
		taken: pieces.filter((code) => code[1]?.toLowerCase() === type),
	})).filter((group) => group.taken.length > 0);

	if (groups.length === 0) return null;

	return (
		<div className={cn("flex items-center gap-0", className)}>
			{groups.map((group) => (
				<div className={cn("flex items-center", OVERLAP)} key={group.type}>
					{group.taken.map((code, index) => (
						<PieceIcon
							className={PIECE}
							code={code}
							// biome-ignore lint/suspicious/noArrayIndexKey: two captured pawns are two captured pawns — position in the stack is the only thing telling them apart
							key={`${code}-${index}`}
							set={pieceSet}
						/>
					))}
				</div>
			))}
		</div>
	);
}
