import {
	createPieces,
	type PieceComponentProps,
} from "@/components/pieces/helper";

/**
 * Marble — turned stone.
 *
 * The classical shape: everything is a lathe profile, so the silhouettes are
 * curves and every piece wears a collar where the body meets its head. Round
 * joins throughout, which is the whole difference from Forge — that set is cut
 * and riveted, this one is turned and polished.
 */
export const MarblePiece = ({
	pieceName,
	isWhite = false,
	squareWidth,
	className,
}: PieceComponentProps) => {
	const fill = isWhite ? "#F2EDE3" : "#4A4F59";
	const stroke = isWhite ? "#9A8F7C" : "#22252B";

	/** Every piece stands on the same foot, so a set reads as a set. */
	const base = <path d="M 11 38 L 34 38 L 32 33 L 13 33 Z" />;

	const paths = {
		Pawn: (
			<>
				{base}
				<path d="M 15 33 Q 17 25 20 21 L 25 21 Q 28 25 30 33 Z" />
				<ellipse cx="22.5" cy="21" rx="7.5" ry="2" />
				<circle cx="22.5" cy="14" r="5" />
			</>
		),
		Rook: (
			<>
				{base}
				<path d="M 14 33 Q 15 26 15.5 20 L 29.5 20 Q 30 26 31 33 Z" />
				<rect height="3.5" rx="1.5" width="21" x="12" y="16.5" />
				<path d="M 12.5 16.5 L 12.5 10 L 16.5 10 L 16.5 13 L 20.5 13 L 20.5 10 L 24.5 10 L 24.5 13 L 28.5 13 L 28.5 10 L 32.5 10 L 32.5 16.5 Z" />
			</>
		),
		Knight: (
			<>
				{base}
				<path d="M 15 33 Q 14 25 18.5 20.5 Q 12.5 18.5 13.5 13 L 17.5 15.5 L 19.5 10.5 Q 27 7.5 31 13.5 Q 34.5 20 31 26.5 L 30 33 Z" />
				<circle cx="26.5" cy="14.5" fill={stroke} r="1.4" stroke="none" />
				<path
					d="M 20.5 11 Q 25 12.5 27.5 17"
					fill="none"
					stroke={stroke}
					strokeWidth="1.2"
				/>
			</>
		),
		Bishop: (
			<>
				{base}
				<path d="M 15 33 Q 16.5 26 19 21.5 L 26 21.5 Q 29.5 26 30 33 Z" />
				<ellipse cx="22.5" cy="21.5" rx="7" ry="2" />
				<path d="M 22.5 8.5 Q 28.5 13.5 27 21 L 18 21 Q 16.5 13.5 22.5 8.5 Z" />
				<path
					d="M 21 12 L 25.5 16.5"
					fill="none"
					stroke={stroke}
					strokeWidth="1.2"
				/>
				<circle cx="22.5" cy="6.5" r="1.8" />
			</>
		),
		Queen: (
			<>
				{base}
				<path d="M 14 33 Q 16 27 17.5 22.5 L 27.5 22.5 Q 29 27 31 33 Z" />
				<ellipse cx="22.5" cy="22.5" rx="8" ry="2" />
				<path d="M 13 22 L 11 12.5 L 16 16.5 L 19 9.5 L 22.5 15 L 26 9.5 L 29 16.5 L 34 12.5 L 32 22 Z" />
				<circle cx="11" cy="11" r="1.8" />
				<circle cx="19" cy="8" r="1.8" />
				<circle cx="26" cy="8" r="1.8" />
				<circle cx="34" cy="11" r="1.8" />
			</>
		),
		King: (
			<>
				{base}
				<path d="M 14 33 Q 16 27 17.5 22.5 L 27.5 22.5 Q 29 27 31 33 Z" />
				<ellipse cx="22.5" cy="22.5" rx="8" ry="2" />
				<path d="M 13.5 22 Q 12 16 14 13 L 19 17 Q 22.5 13 26 17 L 31 13 Q 33 16 31.5 22 Z" />
				<path d="M 21 4 L 24 4 L 24 7 L 27 7 L 27 10 L 24 10 L 24 13 L 21 13 L 21 10 L 18 10 L 18 7 L 21 7 Z" />
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
				stroke={stroke}
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="1.4"
			>
				{paths[pieceName]}
			</g>
		</svg>
	);
};

export const customMarblePieces = createPieces(MarblePiece);
