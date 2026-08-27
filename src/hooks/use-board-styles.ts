"use client";

import { piecesFor } from "@/components/chess-pieces";
import { useBoard } from "@/components/theme/theme-provider";

export const STARTING_FEN =
	"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/**
 * Everything that makes a board look like ours: square colours and the piece
 * set. Shared by the live board, the idle lobby board and the replay viewer so
 * they cannot drift apart.
 *
 * Square colours come from the `[data-board]` variables, not from React state:
 * the server writes that attribute into the HTML from the member's stored
 * choice, so the board is never painted twice. The piece set is React, because
 * it decides which components render.
 */
export function useBoardStyles() {
	const { pieceSet } = useBoard();

	return {
		lightSquareStyle: { backgroundColor: "var(--board-light)" },
		darkSquareStyle: { backgroundColor: "var(--board-dark)" },
		dropSquareStyle: { boxShadow: "inset 0 0 1px 5px rgba(255,255,255,0.55)" },
		boardStyle: { borderRadius: 8, overflow: "hidden" },
		pieces: piecesFor(pieceSet),
	};
}
