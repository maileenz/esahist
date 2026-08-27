/**
 * Wire protocol shared by the browser and the Colyseus process. One copy: the
 * game server imports it from here, so the two can never drift apart.
 */

export type Color = "w" | "b";

export type GameStatus = "waiting" | "playing" | "finished";

/** Standard PGN result token. */
export type GameResult = "1-0" | "0-1" | "1/2-1/2" | "*";

export type EndReason =
	| "checkmate"
	| "stalemate"
	| "insufficient_material"
	| "threefold_repetition"
	| "fifty_move_rule"
	| "timeout"
	| "timeout_vs_insufficient_material"
	| "resignation"
	| "agreement"
	| "abandonment"
	| "aborted"
	| "server_shutdown";

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
