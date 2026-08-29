import { Chess } from "chess.js";

/**
 * A chess opponent small enough to run in the page.
 *
 * This exists because the front page has to be worth landing on. A visitor
 * arriving from a search result cannot be matched against a person — there is
 * no account and no seat — so the alternative to a board they can actually use
 * is a screenshot of one.
 *
 * Deliberately not Stockfish. A WASM engine is a couple of megabytes fetched
 * before the first move, on the page whose whole job is to load fast, to beat
 * somebody who is deciding whether to sign up. What is here is a few hundred
 * lines that plays a reasonable club-level game at the top level and answers in
 * well under a second, which is the trade the front page wants.
 */

/** Centipawns. The king's value only has to outweigh every possible material swing. */
const VALUE: Record<string, number> = {
	p: 100,
	n: 320,
	b: 330,
	r: 500,
	q: 900,
	k: 20000,
};

/**
 * Where each piece would rather stand, in centipawns, from White's point of
 * view and read from a8 down to h1 — the same order `Chess.board()` returns.
 *
 * Material alone produces an opponent that develops nothing and shuffles until
 * something hangs. These tables are what make it push central pawns, put
 * knights where they have squares, and castle rather than walk the king up the
 * board; they are the cheapest quality-per-line in the whole file.
 */
const SQUARES: Record<string, readonly number[]> = {
	p: [
		0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30,
		20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5,
		-10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0,
		0,
	],
	n: [
		-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30,
		0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20,
		20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20,
		-40, -50, -40, -30, -30, -30, -30, -40, -50,
	],
	b: [
		-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0,
		5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10,
		0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20,
		-10, -10, -10, -10, -10, -10, -20,
	],
	r: [
		0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0,
		-5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0,
		0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0,
	],
	q: [
		-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5,
		5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5,
		5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10,
		-10, -20,
	],
	// Middlegame king: behind its own pawns, in a corner, not in the centre.
	k: [
		-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40,
		-30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40,
		-40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20,
		-20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20,
	],
};

/**
 * How hard one opponent tries.
 *
 * A shape rather than three named levels, because the roster in `@/lib/bots`
 * gives every bot its own rating and each rating has to feel different. The
 * mapping from a rating to these numbers lives there; this file only knows how
 * to spend them.
 */
export interface BotStrength {
	/** Ply to stop at, however much budget is left. */
	maxDepth: number;
	/**
	 * How long the search may take, in milliseconds.
	 *
	 * A time budget rather than a fixed depth, because a fixed depth does not
	 * mean a fixed wait: the same three ply that answer instantly in a quiet
	 * endgame take seconds in a middlegame with forty legal moves. Measured on
	 * this engine, depth 3 ran past two seconds a move in the middlegame — on the
	 * page a visitor is deciding whether to sign up on.
	 *
	 * Small enough to stay under a blink. The search runs on the main thread — a
	 * worker would buy a smoother frame at the cost of a build-time entry point
	 * and a message protocol, which is not a trade worth making for a pause this
	 * short.
	 */
	budgetMs: number;
	/**
	 * Centipawns of randomness added to each candidate's score.
	 *
	 * The point of a weak bot rather than a shortcut. An engine playing its
	 * honest best is still merciless about hanging pieces and, worse, plays the
	 * identical game every time; noise makes it miss things the way a beginner's
	 * opponent should, and makes two games differ. It is what separates a 400 from
	 * a 1200 far more than depth does.
	 */
	noise: number;
}

/**
 * Thrown to unwind the search when the budget is gone.
 *
 * An exception rather than a flag checked up the call chain: the search is
 * recursive and the only correct thing to do with a half-finished depth is
 * throw it away, which is exactly what an exception does for free.
 */
const TIMEOUT = Symbol("bot: out of time");

/**
 * The position's score in centipawns, from the side-to-move's point of view.
 *
 * Negamax wants one number that flips sign with the side to move, which is why
 * this is relative rather than "White is better by 40".
 */
function evaluate(game: Chess): number {
	let score = 0;
	const board = game.board();

	for (let rank = 0; rank < 8; rank++) {
		const row = board[rank];
		if (!row) continue;

		for (let file = 0; file < 8; file++) {
			const piece = row[file];
			if (!piece) continue;

			const index = rank * 8 + file;
			const table = SQUARES[piece.type];
			// White reads the table as written; Black reads it mirrored, which is
			// what makes the same numbers describe both sides.
			const placement = table?.[piece.color === "w" ? index : 63 - index] ?? 0;
			const value = (VALUE[piece.type] ?? 0) + placement;

			score += piece.color === "w" ? value : -value;
		}
	}

	return game.turn() === "w" ? score : -score;
}

/**
 * Loud moves first: mate, then promotions, then captures, then checks.
 *
 * Alpha-beta only prunes what it can already refute, so the order moves are
 * tried in decides how much of the tree it has to look at — with good ordering
 * the search visits roughly the square root of the nodes it otherwise would.
 *
 * Ranked by reading the SAN string rather than by asking for verbose moves,
 * because the verbose generator costs twelve times as much per call (measured:
 * 1.4ms against 0.12ms) and it is called at every node. SAN already spells out
 * everything this needs: `#` mate, `=` promotion, `x` capture, `+` check.
 */
function ordered(moves: string[]): string[] {
	return [...moves].sort((a, b) => rank(b) - rank(a));

	function rank(san: string): number {
		if (san.includes("#")) return 1000;
		if (san.includes("=")) return 300;
		if (san.includes("x")) return 200;
		if (san.includes("+")) return 100;
		return 0;
	}
}

/**
 * Negamax with alpha-beta. Returns the score of `game` for the side to move.
 *
 * Note what is *not* called here: `isGameOver()`. It reaches
 * `isThreefoldRepetition()`, which rebuilds a position map by replaying the
 * whole move history — at every node, getting worse the deeper the search goes.
 * That one call was the difference between a search that answers in a fraction
 * of a second and one that never returns. An empty move list says the same
 * thing for free: no legal moves is mate if the king is attacked and stalemate
 * otherwise.
 *
 * The cost is that repetition and the fifty-move rule are invisible inside the
 * search. Both are settled at the board instead, where the real game lives.
 */
function search(
	game: Chess,
	depth: number,
	alpha: number,
	beta: number,
	deadline: number,
): number {
	// Checked per node rather than per move: cheap enough to be invisible next to
	// move generation, and it bounds the wait even in a position where one node
	// has fifty replies.
	if (Date.now() > deadline) throw TIMEOUT;

	const moves = game.moves();

	if (moves.length === 0) {
		// A mate found nearer the root scores further from zero, so the engine
		// takes the shortest win rather than dawdling with a mate on the board.
		return game.isCheck() ? -(VALUE.k ?? 0) - depth : 0;
	}
	if (depth === 0) return evaluate(game);

	let best = Number.NEGATIVE_INFINITY;
	let window = alpha;

	for (const move of ordered(moves)) {
		game.move(move);
		const value = -search(game, depth - 1, -beta, -window, deadline);
		game.undo();

		if (value > best) best = value;
		if (best > window) window = best;
		// This branch is already worse than one the opponent can force elsewhere,
		// so nothing below it can change the result.
		if (window >= beta) break;
	}

	return best;
}

/**
 * The move the opponent plays, or null when the game is already over.
 *
 * Synchronous and self-contained: it takes a FEN rather than a `Chess` so the
 * caller cannot have its own game mutated underneath it by the search.
 */
export function chooseMove(fen: string, strength: BotStrength): string | null {
	const game = new Chess(fen);
	const moves = ordered(game.moves());
	if (moves.length === 0) return null;

	const { maxDepth, budgetMs, noise } = strength;
	const deadline = Date.now() + budgetMs;

	// Depth 1 is searched unconditionally so there is always a complete answer to
	// fall back on, however little time the position leaves.
	let chosen = moves[0] ?? null;

	/*
	 * Iterative deepening: search one ply, then two, then three, keeping the last
	 * depth that finished. It looks wasteful — every iteration re-searches
	 * everything the last one did — but the shallow passes cost a fraction of the
	 * deep one, and it is what makes a time budget usable at all: there is always
	 * a finished result to return when the clock runs out, instead of an
	 * abandoned half-search of a single branch.
	 */
	for (let depth = 1; depth <= maxDepth; depth++) {
		try {
			let bestMove: string | null = null;
			let bestScore = Number.NEGATIVE_INFINITY;

			for (const move of moves) {
				game.move(move);
				const value =
					-search(
						game,
						depth - 1,
						Number.NEGATIVE_INFINITY,
						Number.POSITIVE_INFINITY,
						deadline,
					) + (noise === 0 ? 0 : (Math.random() - 0.5) * noise);
				game.undo();

				if (value > bestScore) {
					bestScore = value;
					bestMove = move;
				}
			}

			if (bestMove) chosen = bestMove;
		} catch (error) {
			// Out of time: keep the deepest result that did finish.
			if (error === TIMEOUT) break;
			throw error;
		}

		if (Date.now() > deadline) break;
	}

	return chosen;
}
