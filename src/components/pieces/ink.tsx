import {
	createPieces,
	type PieceComponentProps,
} from "@/components/pieces/helper";

/**
 * Ink — brush and paper.
 *
 * No colour at all: the white side is paper with an ink outline, the black side
 * is the same shape filled solid. That is the oldest way of telling chess
 * pieces apart in print, and it is the quietest — nothing here competes with
 * the board underneath it.
 *
 * Details that sit *inside* a piece have to be drawn in the opposite tone, or
 * they would vanish on the filled side; hence `mark`.
 */
export const InkPiece = ({
	pieceName,
	isWhite = false,
	squareWidth,
	className,
}: PieceComponentProps) => {
	const ink = "#26262B";
	const paper = "#FAF8F3";
	const fill = isWhite ? paper : ink;
	/** Legible on either side, because it is always the other one. */
	const mark = isWhite ? ink : paper;

	const base = <path d="M 12 37 Q 22.5 39 33 37 L 31 32 Q 22.5 33.5 14 32 Z" />;

	const paths = {
		Pawn: (
			<>
				{base}
				<path d="M 16 32 Q 18 24 20.5 20.5 L 24.5 20.5 Q 27 24 29 32 Z" />
				<circle cx="22.5" cy="15" r="5" />
			</>
		),
		Rook: (
			<>
				{base}
				<path d="M 15 32 Q 16 25 16.5 19 L 28.5 19 Q 29 25 30 32 Z" />
				<path d="M 13.5 19 L 13.5 11.5 L 17.5 11.5 L 17.5 14.5 L 20.5 14.5 L 20.5 11.5 L 24.5 11.5 L 24.5 14.5 L 27.5 14.5 L 27.5 11.5 L 31.5 11.5 L 31.5 19 Z" />
			</>
		),
		Knight: (
			<>
				{base}
				<path d="M 16 32 Q 15 24 19 20 Q 13.5 17.5 14.5 12 L 18.5 14.5 L 20.5 9 Q 28 6.5 31.5 12.5 Q 34.5 19.5 30.5 26 L 29.5 32 Z" />
				<circle cx="26.5" cy="14" fill={mark} r="1.3" stroke="none" />
			</>
		),
		Bishop: (
			<>
				{base}
				<path d="M 16 32 Q 17.5 25 20 21 L 25 21 Q 27.5 25 29 32 Z" />
				<path d="M 22.5 8 Q 28.5 13.5 27 21 L 18 21 Q 16.5 13.5 22.5 8 Z" />
				<path
					d="M 20.5 12 L 25 16.5"
					fill="none"
					stroke={mark}
					strokeWidth="1.3"
				/>
				<circle cx="22.5" cy="5.8" r="1.7" />
			</>
		),
		Queen: (
			<>
				{base}
				<path d="M 15 32 Q 17 26 18 22 L 27 22 Q 28 26 30 32 Z" />
				<path d="M 13 22 L 11 11.5 L 16 16 L 19 8.5 L 22.5 14.5 L 26 8.5 L 29 16 L 34 11.5 L 32 22 Z" />
				<path
					d="M 14.5 19.5 L 30.5 19.5"
					fill="none"
					stroke={mark}
					strokeWidth="1.2"
				/>
			</>
		),
		King: (
			<>
				{base}
				<path d="M 15 32 Q 17 26 18 22 L 27 22 Q 28 26 30 32 Z" />
				<path d="M 14 22 Q 12.5 15.5 15 12.5 L 19.5 17 Q 22.5 13 25.5 17 L 30 12.5 Q 32.5 15.5 31 22 Z" />
				<path d="M 21 3.5 L 24 3.5 L 24 7 L 27.5 7 L 27.5 10 L 24 10 L 24 13.5 L 21 13.5 L 21 10 L 17.5 10 L 17.5 7 L 21 7 Z" />
			</>
		),
	};

	return (
		<svg
			className={className}
			height={squareWidth}
			role="img"
			viewBox="0 0 45 45"
			width={squareWidth}
			xmlns="http://www.w3.org/2000/svg"
		>
			<title>{`${isWhite ? "White" : "Black"} ${pieceName.toLowerCase()}`}</title>
			<g
				fill={fill}
				stroke={ink}
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="1.6"
			>
				{paths[pieceName]}
			</g>
		</svg>
	);
};

export const customInkPieces = createPieces(InkPiece);
