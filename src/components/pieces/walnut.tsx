import {
	createPieces,
	type PieceComponentProps,
} from "@/components/pieces/helper";

/**
 * Walnut — a wooden set on a club table.
 *
 * Maple against walnut, the two timbers a real set is actually made of, and the
 * one thing that makes it read as wood rather than plastic: a couple of grain
 * lines curving with the turn of each piece. They are drawn at low opacity so
 * they suggest the material without becoming pattern.
 */
export const WalnutPiece = ({
	pieceName,
	isWhite = false,
	squareWidth,
	className,
}: PieceComponentProps) => {
	const fill = isWhite ? "#E3CDA4" : "#5C3B26";
	const stroke = isWhite ? "#9C7440" : "#2E1B0E";

	/** The turned foot every piece stands on. */
	const base = <path d="M 11 38 L 34 38 L 32 33 L 13 33 Z" />;

	/** Grain, following the lathe rather than cutting across it. */
	const grain = (d: string) => (
		<path d={d} fill="none" opacity="0.35" stroke={stroke} strokeWidth="0.9" />
	);

	const paths = {
		Pawn: (
			<>
				{base}
				<path d="M 15 33 Q 17 25 20 21 L 25 21 Q 28 25 30 33 Z" />
				{grain("M 18.5 31 Q 20 26 21.5 22")}
				{grain("M 26 31 Q 25 26 24 22")}
				<ellipse cx="22.5" cy="21" rx="7.5" ry="1.9" />
				<circle cx="22.5" cy="14.5" r="5" />
			</>
		),
		Rook: (
			<>
				{base}
				<path d="M 14 33 Q 15 26 15.5 20 L 29.5 20 Q 30 26 31 33 Z" />
				{grain("M 18.5 32 L 19 21")}
				{grain("M 26.5 32 L 26 21")}
				<rect height="3.2" rx="1.4" width="21" x="12" y="17" />
				<path d="M 12.5 17 L 12.5 10.5 L 16.5 10.5 L 16.5 13.5 L 20.5 13.5 L 20.5 10.5 L 24.5 10.5 L 24.5 13.5 L 28.5 13.5 L 28.5 10.5 L 32.5 10.5 L 32.5 17 Z" />
			</>
		),
		Knight: (
			<>
				{base}
				<path d="M 15 33 Q 14 25 18.5 20.5 Q 12.5 18.5 13.5 13 L 17.5 15.5 L 19.5 10.5 Q 27 7.5 31 13.5 Q 34.5 20 31 26.5 L 30 33 Z" />
				{grain("M 21 12.5 Q 26 14.5 28.5 19")}
				{grain("M 19 22 Q 24 24 28 23")}
				<circle cx="26.5" cy="14.5" fill={stroke} r="1.3" stroke="none" />
			</>
		),
		Bishop: (
			<>
				{base}
				<path d="M 15 33 Q 16.5 26 19 21.5 L 26 21.5 Q 29.5 26 30 33 Z" />
				{grain("M 19 32 Q 20.5 27 22 22.5")}
				{grain("M 26 32 Q 25 27 24 22.5")}
				<ellipse cx="22.5" cy="21.5" rx="7" ry="1.9" />
				<path d="M 22.5 8.5 Q 28.5 13.5 27 21 L 18 21 Q 16.5 13.5 22.5 8.5 Z" />
				<path
					d="M 20.5 12.5 L 25 17"
					fill="none"
					opacity="0.5"
					stroke={stroke}
					strokeWidth="1.1"
				/>
				<circle cx="22.5" cy="6.4" r="1.7" />
			</>
		),
		Queen: (
			<>
				{base}
				<path d="M 14 33 Q 16 27 17.5 22.5 L 27.5 22.5 Q 29 27 31 33 Z" />
				{grain("M 18.5 32 Q 19.5 27 20.5 23")}
				{grain("M 26.5 32 Q 25.5 27 24.5 23")}
				<ellipse cx="22.5" cy="22.5" rx="8" ry="1.9" />
				<path d="M 13 22 L 11 12.5 L 16 16.5 L 19 9.5 L 22.5 15 L 26 9.5 L 29 16.5 L 34 12.5 L 32 22 Z" />
				<circle cx="19" cy="8.2" r="1.6" />
				<circle cx="26" cy="8.2" r="1.6" />
			</>
		),
		King: (
			<>
				{base}
				<path d="M 14 33 Q 16 27 17.5 22.5 L 27.5 22.5 Q 29 27 31 33 Z" />
				{grain("M 18.5 32 Q 19.5 27 20.5 23")}
				{grain("M 26.5 32 Q 25.5 27 24.5 23")}
				<ellipse cx="22.5" cy="22.5" rx="8" ry="1.9" />
				<path d="M 13.5 22 Q 12 16 14 13 L 19 17 Q 22.5 13 26 17 L 31 13 Q 33 16 31.5 22 Z" />
				<path d="M 21 4 L 24 4 L 24 7.5 L 27.5 7.5 L 27.5 10.5 L 24 10.5 L 24 14 L 21 14 L 21 10.5 L 17.5 10.5 L 17.5 7.5 L 21 7.5 Z" />
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
				strokeWidth="1.3"
			>
				{paths[pieceName]}
			</g>
		</svg>
	);
};

export const customWalnutPieces = createPieces(WalnutPiece);
