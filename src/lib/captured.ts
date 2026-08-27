/**
 * Captured material, read straight off a FEN.
 *
 * Nothing tracks captures during a game — the room only ever stores the
 * position — so this counts what is *missing* from the board instead. That is
 * the same shortcut every site takes, and it has the same known flaw: a
 * promoted pawn reads as a captured pawn, because the position cannot tell you
 * the difference.
 */

/** How many of each piece a side starts with. Kings never leave the board. */
const STARTING: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };

/** Ordinary piece values, for the "+3" material edge. */
const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };

export interface CapturedMaterial {
	/** Black pieces White has taken, as image codes: `bp`, `bn`… */
	byWhite: string[];
	/** White pieces Black has taken. */
	byBlack: string[];
	/** Material difference from White's side; negative means Black is ahead. */
	advantage: number;
}

export function capturedFrom(fen: string): CapturedMaterial {
	const placement = fen.split(" ")[0] ?? "";

	const counts: Record<string, number> = {};
	for (const character of placement) {
		if (/[a-zA-Z]/.test(character)) {
			counts[character] = (counts[character] ?? 0) + 1;
		}
	}

	const byWhite: string[] = [];
	const byBlack: string[] = [];
	let advantage = 0;

	// Ordered by value, so the row reads pawns first the way a player expects.
	for (const [type, full] of Object.entries(STARTING)) {
		const whiteLeft = counts[type.toUpperCase()] ?? 0;
		const blackLeft = counts[type] ?? 0;

		for (let i = 0; i < full - blackLeft; i++) byWhite.push(`b${type}`);
		for (let i = 0; i < full - whiteLeft; i++) byBlack.push(`w${type}`);

		advantage += (whiteLeft - blackLeft) * (VALUE[type] ?? 0);
	}

	return { byWhite, byBlack, advantage };
}
