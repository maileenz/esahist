import {
	createPieces,
	type PieceComponentProps,
} from "@/components/pieces/helper";

/**
 * Origami — folded paper.
 *
 * Every piece is flat planes meeting at a crease. The trick is the second
 * colour: each shape is drawn twice, once in the paper's face and once in the
 * shade it falls into, so a piece has a lit side and a turned-away side without
 * a single gradient. Straight edges only, and a hairline stroke — paper has an
 * edge, not an outline.
 */
export const OrigamiPiece = ({
	pieceName,
	isWhite = false,
	squareWidth,
	className,
}: PieceComponentProps) => {
	const face = isWhite ? "#F7F1E3" : "#42537A";
	const shade = isWhite ? "#D9CCAE" : "#2A3453";
	const stroke = isWhite ? "#A99873" : "#1B2138";

	/** The sheet everything is folded from, and the crease down its middle. */
	const base = (
		<>
			<path d="M 10 38 L 35 38 L 32 33 L 13 33 Z" />
			<path d="M 22.5 33 L 22.5 38 L 35 38 L 32 33 Z" fill={shade} />
		</>
	);

	const paths = {
		Pawn: (
			<>
				{base}
				<path d="M 15 33 L 19 21 L 26 21 L 30 33 Z" />
				<path d="M 22.5 21 L 22.5 33 L 30 33 L 26 21 Z" fill={shade} />
				<path d="M 22.5 9 L 28 15 L 22.5 21 L 17 15 Z" />
				<path d="M 22.5 9 L 28 15 L 22.5 21 Z" fill={shade} />
			</>
		),
		Rook: (
			<>
				{base}
				<path d="M 14 33 L 15.5 18 L 29.5 18 L 31 33 Z" />
				<path d="M 22.5 18 L 22.5 33 L 31 33 L 29.5 18 Z" fill={shade} />
				<path d="M 12.5 18 L 12.5 10 L 17 10 L 17 13.5 L 20.5 13.5 L 20.5 10 L 24.5 10 L 24.5 13.5 L 28 13.5 L 28 10 L 32.5 10 L 32.5 18 Z" />
				<path
					d="M 22.5 18 L 32.5 18 L 32.5 10 L 28 10 L 28 13.5 L 24.5 13.5 L 24.5 10 L 22.5 10 Z"
					fill={shade}
				/>
			</>
		),
		Knight: (
			<>
				{base}
				<path d="M 15 33 L 18 21 L 12 17 L 15 11 L 19 14 L 21 8 L 31 12 L 33 22 L 29 33 Z" />
				<path
					d="M 21 8 L 31 12 L 33 22 L 29 33 L 24 33 L 25 18 Z"
					fill={shade}
				/>
				<path d="M 24.5 13 L 27.5 14 L 26 16.5 Z" fill={stroke} stroke="none" />
			</>
		),
		Bishop: (
			<>
				{base}
				<path d="M 15 33 L 18.5 21 L 26.5 21 L 30 33 Z" />
				<path d="M 22.5 21 L 22.5 33 L 30 33 L 26.5 21 Z" fill={shade} />
				<path d="M 22.5 7 L 28.5 16 L 26.5 21 L 18.5 21 L 16.5 16 Z" />
				<path d="M 22.5 7 L 28.5 16 L 26.5 21 L 22.5 21 Z" fill={shade} />
				<path
					d="M 20 12 L 25 17.5"
					fill="none"
					stroke={stroke}
					strokeWidth="1"
				/>
			</>
		),
		Queen: (
			<>
				{base}
				<path d="M 14 33 L 17.5 22 L 27.5 22 L 31 33 Z" />
				<path d="M 22.5 22 L 22.5 33 L 31 33 L 27.5 22 Z" fill={shade} />
				<path d="M 12 22 L 10 10 L 16 16 L 19 8 L 22.5 14 L 26 8 L 29 16 L 35 10 L 33 22 Z" />
				<path
					d="M 22.5 14 L 26 8 L 29 16 L 35 10 L 33 22 L 22.5 22 Z"
					fill={shade}
				/>
			</>
		),
		King: (
			<>
				{base}
				<path d="M 14 33 L 17.5 22 L 27.5 22 L 31 33 Z" />
				<path d="M 22.5 22 L 22.5 33 L 31 33 L 27.5 22 Z" fill={shade} />
				<path d="M 13 22 L 14 13 L 19 17 L 22.5 12 L 26 17 L 31 13 L 32 22 Z" />
				<path d="M 22.5 12 L 26 17 L 31 13 L 32 22 L 22.5 22 Z" fill={shade} />
				<path d="M 21 3 L 24 3 L 24 6.5 L 27.5 6.5 L 27.5 9.5 L 24 9.5 L 24 13 L 21 13 L 21 9.5 L 17.5 9.5 L 17.5 6.5 L 21 6.5 Z" />
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
			<g fill={face} stroke={stroke} strokeLinejoin="miter" strokeWidth="1">
				{paths[pieceName]}
			</g>
		</svg>
	);
};

export const customOrigamiPieces = createPieces(OrigamiPiece);
