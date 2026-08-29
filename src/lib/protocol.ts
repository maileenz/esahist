/**
 * Wire protocol shared by the browser and the Colyseus process. One copy: the
 * game server imports it from here, so the two can never drift apart.
 */

export type Color = "w" | "b";

export type GameStatus = "waiting" | "playing" | "finished";

/** Standard PGN result token. */
export type GameResult = "1-0" | "0-1" | "1/2-1/2" | "*";

/**
 * An array rather than a bare union, so the same twelve values can be checked
 * at run time. A finished game's reason comes back out of the database as a
 * plain `varchar`, and anything rendering it needs to know whether the string
 * still names a reason before using it as a message key.
 */
export const END_REASONS = [
	"checkmate",
	"stalemate",
	"insufficient_material",
	"threefold_repetition",
	"fifty_move_rule",
	"timeout",
	"timeout_vs_insufficient_material",
	"resignation",
	"agreement",
	"abandonment",
	"aborted",
	"server_shutdown",
] as const;

export type EndReason = (typeof END_REASONS)[number];

export function isEndReason(value: unknown): value is EndReason {
	return (
		typeof value === "string" &&
		(END_REASONS as readonly string[]).includes(value)
	);
}

/** Messages the client sends to the room. */
export const ClientMessage = {
	Move: "move",
	Resign: "resign",
	Abort: "abort",
	OfferDraw: "draw:offer",
	AcceptDraw: "draw:accept",
	DeclineDraw: "draw:decline",
	Rematch: "rematch",
	CancelRematch: "rematch:cancel",
} as const;

/** Messages the room sends to clients. */
export const ServerMessage = {
	GameStart: "game:start",
	GameOver: "game:over",
	MoveRejected: "move:rejected",
	DrawOffered: "draw:offered",
	DrawDeclined: "draw:declined",
	OpponentDropped: "opponent:dropped",
	OpponentReturned: "opponent:returned",
	Notice: "notice",
} as const;

interface RatingChange {
	userId: string;
	before: number;
	after: number;
	delta: number;
}

export interface GameOverPayload {
	gameId: string;
	result: GameResult;
	reason: EndReason;
	winnerColor: Color | null;
	pgn: string;
	ratings: RatingChange[] | null;
}

export type MoveRejectedReason =
	| "not_your_turn"
	| "game_not_active"
	| "illegal_move"
	| "not_a_player";

export interface MoveRejectedPayload {
	reason: MoveRejectedReason;
	/** Authoritative position, so the client can resync after a bad optimistic move. */
	fen: string;
}
