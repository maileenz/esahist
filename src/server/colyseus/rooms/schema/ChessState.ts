import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import { DEFAULT_RATING } from "../../../db/schema";

export const STARTING_FEN =
	"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export class PlayerState extends Schema {
	/** Stable user id from the auth token — survives reconnects. */
	@type("string") userId = "";
	/** URL identity, so a seat can link to the member's profile mid-game. */
	@type("string") username = "";
	@type("string") name = "";
	/** ISO 3166-1 alpha-2; empty when the member has not set one. */
	@type("string") country = "";
	/** Flair catalogue id; empty when they wear none. */
	@type("string") flair = "";
	@type("string") image = "";
	/** "w" | "b" */
	@type("string") color = "";
	@type("uint16") rating = DEFAULT_RATING;
	/** Authoritative clock, updated by the server tick and on every move. */
	@type("uint32") timeLeftMs = 0;
	@type("boolean") connected = false;
	@type("boolean") offeringDraw = false;
	@type("boolean") wantsRematch = false;
}

export class ChessState extends Schema {
	@type("string") gameId = "";

	/** "waiting" | "playing" | "finished" */
	@type("string") status = "waiting";

	/** Authoritative position. The client mirrors this into its own chess.js. */
	@type("string") fen = STARTING_FEN;
	/** "w" | "b" */
	@type("string") turn = "w";
	@type("uint16") ply = 0;
	@type("boolean") inCheck = false;

	/** SAN move list, enough to render a move sheet and rebuild the game. */
	@type(["string"]) history = new ArraySchema<string>();
	/**
	 * Milliseconds spent on each half-move, indexed alongside `history`. Kept as
	 * a parallel array rather than folded into a move object so the existing
	 * SAN list — which persistence and the move sheet both read — is untouched.
	 */
	@type(["uint32"]) thinkMs = new ArraySchema<number>();
	@type("string") lastMoveFrom = "";
	@type("string") lastMoveTo = "";

	@type({ map: PlayerState }) players = new MapSchema<PlayerState>();
	@type("string") whiteSessionId = "";
	@type("string") blackSessionId = "";

	@type("string") timeControl = "";
	@type("uint32") initialTimeMs = 0;
	@type("uint32") incrementMs = 0;
	@type("boolean") ranked = true;

	/** "1-0" | "0-1" | "1/2-1/2" | "" while unfinished */
	@type("string") result = "";
	@type("string") reason = "";
	/** "w" | "b" | "" for a draw */
	@type("string") winnerColor = "";

	/**
	 * Room clock reading when the side to move started thinking. Clients can
	 * interpolate between server ticks for a smooth countdown.
	 */
	@type("number") turnStartedAt = 0;
}
