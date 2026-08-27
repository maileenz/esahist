import type { PieceRenderObject } from "react-chessboard";

import { createPieces, PIECE_ROLES, SVG_PIECE_SETS } from "@/components/pieces";
import { DEFAULT_PIECE_SET, resolvePieceSet } from "@/lib/themes";

/**
 * Whatever draws this set, with the default standing in for a set that has been
 * listed but never registered — twelve blank squares being the alternative.
 */
function componentFor(setId: string) {
	const { id } = resolvePieceSet(setId);
	return SVG_PIECE_SETS[id] ?? SVG_PIECE_SETS[DEFAULT_PIECE_SET];
}

/**
 * The renderers for one piece set.
 *
 * Every set is a component now, the sprites included, so there is one path
 * through here rather than a branch per kind of set.
 */
export function piecesFor(setId: string): PieceRenderObject {
	const Component = componentFor(setId);
	return Component ? createPieces(Component) : {};
}

/**
 * One piece from a set, outside a board — the settings swatches and preview,
 * the move sheet's figurines, the strip of captured pieces. Whatever the set
 * actually draws is what shows up here, so choosing is not a guess.
 */
export function PieceIcon({
	set,
	code,
	className,
}: {
	set: string;
	/** `wN`, `bq` — case does not matter. */
	code: string;
	className?: string;
}) {
	const key = `${code[0]?.toLowerCase()}${code[1]?.toUpperCase()}`;
	const role = PIECE_ROLES[key];
	const Component = componentFor(set);

	if (!(role && Component)) return null;

	return (
		// No `squareWidth`: the caller's classes decide how big it is.
		<Component
			className={className}
			isWhite={role.isWhite}
			pieceName={role.piece}
		/>
	);
}
