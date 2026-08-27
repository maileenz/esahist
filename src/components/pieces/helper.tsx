import type { PieceRenderObject } from "react-chessboard";

/**
 * Building a piece set.
 *
 * A set is one component that can draw any of the six pieces in either colour.
 * Everything else — the twelve renderers the board wants, the codes they are
 * keyed by, which code means which piece — is the same for every set, so it
 * lives here and a new set is a single file that draws shapes.
 */

export type Piece = "Pawn" | "Rook" | "Knight" | "Bishop" | "Queen" | "King";

export interface PieceComponentProps {
	pieceName: Piece;
	isWhite?: boolean;
	/**
	 * A pixel size. react-chessboard v5 does not pass one — it sizes the square
	 * itself and the piece fills it — so this is for callers that do know the
	 * size in advance. Left off, the `viewBox` scales the piece to whatever box
	 * CSS puts it in: the move sheet's 18px figurines, a settings swatch, the
	 * strip of captured pieces.
	 */
	squareWidth?: number;
	className?: string;
}

/** A set is any component that can draw one piece. */
export type PieceComponent = (props: PieceComponentProps) => React.JSX.Element;

/**
 * `wP` → what to draw.
 *
 * The colour-and-letter codes are react-chessboard's, and they are what the
 * rest of the app indexes pieces by too — captured strips, move sheets,
 * settings swatches.
 */
export const PIECE_ROLES: Record<string, { piece: Piece; isWhite: boolean }> = {
	wP: { piece: "Pawn", isWhite: true },
	wN: { piece: "Knight", isWhite: true },
	wB: { piece: "Bishop", isWhite: true },
	wR: { piece: "Rook", isWhite: true },
	wQ: { piece: "Queen", isWhite: true },
	wK: { piece: "King", isWhite: true },
	bP: { piece: "Pawn", isWhite: false },
	bN: { piece: "Knight", isWhite: false },
	bB: { piece: "Bishop", isWhite: false },
	bR: { piece: "Rook", isWhite: false },
	bQ: { piece: "Queen", isWhite: false },
	bK: { piece: "King", isWhite: false },
};

/**
 * The twelve renderers a board asks for, from one component.
 *
 * Generated rather than written out, so a code cannot end up wired to the wrong
 * glyph — the sort of mistake that only shows up when somebody's bishop moves
 * like a knight.
 *
 * Each piece fills its square with CSS: v5 hands renderers `{ fill, square,
 * svgStyle }` and no width, so there is no pixel size to read here.
 */
export function createPieces(Component: PieceComponent): PieceRenderObject {
	return Object.fromEntries(
		Object.entries(PIECE_ROLES).map(([code, { piece, isWhite }]) => [
			code,
			() => (
				<Component
					className="h-full w-full"
					isWhite={isWhite}
					pieceName={piece}
				/>
			),
		]),
	);
}
