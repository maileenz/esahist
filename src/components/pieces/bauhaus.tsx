import {
	createPieces,
	type PieceComponentProps,
} from "@/components/pieces/helper";

/**
 * Bauhaus — each piece reduced to the fewest primitives that still name it.
 *
 * Circle, rectangle, triangle, and one arc for the knight. One muted accent per
 * piece carries the part that identifies it — the pawn's head, the bishop's
 * point, the king's cross — so the eye has one thing to read per square rather
 * than six.
 *
 * The edge is not decoration, and neither is the sand the light side is painted
 * in. Both are the answer to a measurement: against the six board themes, a
 * cream body scored 1.01 contrast on Ocean's light squares — the piece and the
 * square were the same value, so the knight simply was not there. No warm cream
 * can win that, because Wood's light square is a cream too.
 *
 * So the separation is done twice over. The body drops to a sand that keeps
 * 1.3–1.5 against every light square while still reading as the light side
 * (1.6–2.3 against the dark ones), and the edge — a darker tone of the piece's
 * own colour — carries 4.4–5.2 on its own. Either would do at board size; both
 * are what make it survive an 18px figurine in the move sheet.
 */
export const BauhausPiece = ({
	pieceName,
	isWhite = false,
	squareWidth,
	className,
}: PieceComponentProps) => {
	const body = isWhite ? "#D3C3A0" : "#3D444F";
	const accent = isWhite ? "#8A5A1E" : "#8496AA";
	const edge = isWhite ? "#6E6247" : "#1E232B";

	/** Same plinth under everything, so the set reads as one system. */
	const base = <rect height="5" rx="1" width="22" x="11.5" y="33" />;

	const paths = {
		Pawn: (
			<>
				{base}
				<path d="M 17 33 L 19.5 22 L 25.5 22 L 28 33 Z" />
				<circle cx="22.5" cy="16" fill={accent} r="5.5" />
			</>
		),
		Rook: (
			<>
				{base}
				<path d="M 15.5 33 L 16.5 19 L 28.5 19 L 29.5 33 Z" />
				<rect fill={accent} height="3" width="18" x="13.5" y="16" />
				<rect fill={accent} height="5" width="4" x="13.5" y="11" />
				<rect fill={accent} height="5" width="4" x="20.5" y="11" />
				<rect fill={accent} height="5" width="4" x="27.5" y="11" />
			</>
		),
		Knight: (
			<>
				{base}
				<path d="M 15 33 L 15 21 A 10 10 0 0 1 25 11 L 32 11 L 32 18 L 25 18 A 3 3 0 0 0 22 21 L 22 33 Z" />
				<circle cx="27.5" cy="14.5" fill={accent} r="1.8" />
			</>
		),
		Bishop: (
			<>
				{base}
				<path d="M 16.5 33 L 18.5 22 L 26.5 22 L 28.5 33 Z" />
				<path d="M 22.5 8 L 30 22 L 15 22 Z" fill={accent} />
			</>
		),
		Queen: (
			<>
				{base}
				<path d="M 16 33 L 18 22 L 27 22 L 29 33 Z" />
				<path
					d="M 13 22 L 13 15 A 9.5 9.5 0 0 1 32 15 L 32 22 Z"
					fill={accent}
				/>
				<circle cx="16.5" cy="10" fill={body} r="2.2" />
				<circle cx="22.5" cy="7.5" fill={body} r="2.2" />
				<circle cx="28.5" cy="10" fill={body} r="2.2" />
			</>
		),
		King: (
			<>
				{base}
				<path d="M 16 33 L 18 22 L 27 22 L 29 33 Z" />
				<rect height="9" width="19" x="13" y="13" />
				<rect fill={accent} height="12" width="4" x="20.5" y="3" />
				<rect fill={accent} height="4" width="12" x="16.5" y="7" />
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
			<g fill={body} stroke={edge} strokeLinejoin="round" strokeWidth="1.3">
				{paths[pieceName]}
			</g>
		</svg>
	);
};

export const customBauhausPieces = createPieces(BauhausPiece);
