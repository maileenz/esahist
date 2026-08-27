import {
	createPieces,
	type PieceComponentProps,
} from "@/components/pieces/helper";

export const ForgePiece = ({
	pieceName,
	isWhite = false,
	squareWidth,
	className,
}: PieceComponentProps) => {
	// Theme colors: Copper for White, Pig Iron for Black
	const fill = isWhite ? "#D97757" : "#3E4147";
	const stroke = isWhite ? "#2B1B17" : "#18191B";

	const paths = {
		Pawn: (
			<>
				<path d="M 9 38 L 36 38 L 33 33 L 12 33 Z" />
				<rect height="11" width="13" x="16" y="22" />
				<line
					stroke={stroke}
					strokeWidth="1.5"
					x1="16"
					x2="29"
					y1="26"
					y2="26"
				/>
				<line
					stroke={stroke}
					strokeWidth="1.5"
					x1="16"
					x2="29"
					y1="29"
					y2="29"
				/>
				<polygon points="22.5,9 31,14 31,22 14,22 14,14" />
			</>
		),
		Rook: (
			<>
				<path d="M 8 38 L 37 38 L 34 33 L 11 33 Z" />
				<path d="M 12 33 L 14 16 L 31 16 L 33 33 Z" />
				<line
					stroke={stroke}
					strokeWidth="1.5"
					x1="18.5"
					x2="18.5"
					y1="16"
					y2="33"
				/>
				<line
					stroke={stroke}
					strokeWidth="1.5"
					x1="22.5"
					x2="22.5"
					y1="16"
					y2="33"
				/>
				<line
					stroke={stroke}
					strokeWidth="1.5"
					x1="26.5"
					x2="26.5"
					y1="16"
					y2="33"
				/>
				<path d="M 11 10 L 11 16 L 34 16 L 34 10 L 30 10 L 30 13 L 25 13 L 25 10 L 20 10 L 20 13 L 15 13 L 15 10 Z" />
			</>
		),
		Knight: (
			<>
				<path d="M 9 38 L 36 38 L 32 33 L 13 33 Z" />
				<path d="M 16 33 L 17 25 L 11 19 L 28 11 L 35 15 L 29 23 L 26 33 Z" />
				<circle cx="26" cy="16" fill={stroke} r="1.5" stroke="none" />
			</>
		),
		Bishop: (
			<>
				<path d="M 10 38 L 35 38 L 32 33 L 13 33 Z" />
				<path d="M 14 33 L 16 18 L 29 18 L 31 33 Z" />
				<path d="M 15 18 L 13 9 L 32 14 L 30 18 Z" />
				<line
					stroke={stroke}
					strokeLinecap="square"
					strokeWidth="1.5"
					x1="17"
					x2="27"
					y1="13"
					y2="22"
				/>
			</>
		),
		Queen: (
			<>
				<path d="M 8 38 L 37 38 L 33 33 L 12 33 Z" />
				<path d="M 14 33 L 16 22 L 29 22 L 31 33 Z" />
				<path d="M 10 10 L 14 22 L 31 22 L 35 10 L 30 14 L 26 8 L 22.5 13 L 19 8 L 15 14 Z" />
				<circle cx="22.5" cy="17" fill={stroke} r="2.5" stroke="none" />
			</>
		),
		King: (
			<>
				<path d="M 8 38 L 37 38 L 33 33 L 12 33 Z" />
				<path d="M 13 33 L 13 30 L 18 30 L 18 18 L 13 18 L 13 15 L 32 15 L 32 18 L 27 18 L 27 30 L 32 30 L 32 33 Z" />
				<path d="M 20 6 L 25 6 L 25 9 L 29 9 L 29 12 L 25 12 L 25 15 L 20 15 L 20 12 L 16 12 L 16 9 L 20 9 Z" />
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
			<g fill={fill} stroke={stroke} strokeLinejoin="miter" strokeWidth="1.5">
				{paths[pieceName]}
			</g>
		</svg>
	);
};

/** The board's twelve renderers, from the one component above. */
export const customForgePieces = createPieces(ForgePiece);
