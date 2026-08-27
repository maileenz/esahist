import { BauhausPiece } from "@/components/pieces/bauhaus";
import { ForgePiece } from "@/components/pieces/forge";
import type { PieceComponent } from "@/components/pieces/helper";
import { InkPiece } from "@/components/pieces/ink";
import { MarblePiece } from "@/components/pieces/marble";
import { OrigamiPiece } from "@/components/pieces/origami";
import { WalnutPiece } from "@/components/pieces/walnut";

/**
 * Every set, by the id it has in `PIECE_SETS`.
 *
 * All of them, including the sprite set — a piece set is a component here, and
 * what it paints with is its own business.
 *
 * This is the whole registration step: a new set is a file next to this one and
 * a line here, plus its entry in `lib/themes.ts`. Nothing downstream — the
 * board, the move sheet, the settings swatches — needs to learn its name.
 */
export const SVG_PIECE_SETS: Record<string, PieceComponent> = {
	forge: ForgePiece,
	marble: MarblePiece,
	origami: OrigamiPiece,
	walnut: WalnutPiece,
	ink: InkPiece,
	bauhaus: BauhausPiece,
};

export type {
	Piece,
	PieceComponent,
	PieceComponentProps,
} from "@/components/pieces/helper";
export { createPieces, PIECE_ROLES } from "@/components/pieces/helper";
