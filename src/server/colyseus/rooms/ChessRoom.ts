import { randomUUID } from "node:crypto";
import { Chess, type Move, type Square } from "chess.js";
import {
	type AuthContext,
	type Client,
	type Delayed,
	Room,
	ServerError,
	validate,
} from "colyseus";
import { z } from "zod";
import {
	ClientMessage,
	type Color,
	type EndReason,
	type GameResult,
	type MoveRejectedReason,
	ServerMessage,
} from "../../../lib/protocol";
import {
	resolveTimeControl,
	type TimeControl,
} from "../../../lib/timeControls";
import { type AuthUser, authenticate } from "../lib/auth";
import { areBlocked } from "../lib/blocks";
import {
	computeRatingChanges,
	type RatingDelta,
	ratingBucketOf,
} from "../lib/glicko";
import { type GameRecord, getGameStore, type MoveRecord } from "../lib/store";
import { ChessState, PlayerState, STARTING_FEN } from "./schema/ChessState";

/** How long a dropped player keeps their seat before forfeiting. */
const RECONNECT_WINDOW_SECONDS = 60;
/** Clock resolution. The client interpolates between ticks. */
const CLOCK_TICK_MS = 200;
/** Keep the room alive after the result so both sides can look at the board / rematch. */
const POST_GAME_LINGER_MS = 3 * 60_000;
/** Below this ply an early exit is an abort (unrated) rather than a loss. */
const MIN_PLY_FOR_RATED_RESULT = 2;
/**
 * How far from your own rating band you may ask to be matched. `matchmake()`
 * widens the search by one bucket before opening a room of its own; anything
 * past that is a client claiming a band it has no business being in. Raising
 * the client's `spread` means raising this too.
 */
const MAX_BUCKET_SPREAD = 1;

const SQUARE = /^[a-h][1-8]$/;

const MoveMessage = z.object({
	from: z.string().regex(SQUARE),
	to: z.string().regex(SQUARE),
	promotion: z.enum(["q", "r", "b", "n"]).optional(),
});

interface JoinOptions {
	timeControl?: string;
	ranked?: boolean;
	ratingBucket?: number;
}

type ChessClient = Client<{
	userData: { userId: string; color: Color };
	auth: AuthUser;
}>;

export class ChessRoom extends Room<{
	state: ChessState;
	client: ChessClient;
}> {
	maxClients = 2;
	patchRate = 50;
	/** Colyseus drops clients that exceed this — cheap flood protection. */
	maxMessagesPerSecond = 20;
	seatReservationTimeout = 20;

	state = new ChessState();

	private chess = new Chess();
	private readonly store = getGameStore();
	private readonly seats = new Map<string, AuthUser>(); // sessionId -> user
	private timeControl!: TimeControl;
	private clockInterval?: Delayed;
	private disposeTimer?: Delayed;
	private startedAt = 0;
	private persisted = false;
	private moveLog: MoveRecord[] = [];
	private lastMoveAt = 0;
	/**
	 * What the game that just ended did to the two seats.
	 *
	 * Held rather than applied immediately: `persistGame` stores the rating each
	 * player *started* the game on, and it reads that from the same seats.
	 */
	private lastRatings: RatingDelta[] | null = null;

	// ---------------------------------------------------------------- auth

	/**
	 * Reads the Auth.js session cookie off the matchmaking request and resolves it
	 * against the database. Runs before a seat is reserved, so a signed-out,
	 * expired or banned user never reaches `onJoin`.
	 */
	static async onAuth(
		_token: string,
		_options: JoinOptions,
		context: AuthContext,
	) {
		const user = await authenticate(context);
		if (!user) throw new ServerError(401, "unauthorized");
		return user;
	}

	// ------------------------------------------------------------ messages

	messages = {
		[ClientMessage.Move]: validate(
			MoveMessage,
			(client: ChessClient, payload: z.infer<typeof MoveMessage>) =>
				this.handleMove(client, payload),
		),
		[ClientMessage.Resign]: (client: ChessClient) => this.handleResign(client),
		[ClientMessage.Abort]: (client: ChessClient) => this.handleAbort(client),
		[ClientMessage.OfferDraw]: (client: ChessClient) =>
			this.handleDrawOffer(client),
		[ClientMessage.AcceptDraw]: (client: ChessClient) =>
			this.handleDrawAccept(client),
		[ClientMessage.DeclineDraw]: (client: ChessClient) =>
			this.handleDrawDecline(client),
		[ClientMessage.Rematch]: (client: ChessClient) =>
			this.handleRematch(client, true),
		[ClientMessage.CancelRematch]: (client: ChessClient) =>
			this.handleRematch(client, false),
	};

	// ------------------------------------------------------------ lifecycle

	onCreate(options: JoinOptions) {
		this.timeControl = resolveTimeControl(options.timeControl);

		this.state.gameId = randomUUID();
		this.state.timeControl = this.timeControl.id;
		this.state.initialTimeMs = this.timeControl.initialMs;
		this.state.incrementMs = this.timeControl.incrementMs;
		this.state.ranked = options.ranked !== false;
		this.state.fen = STARTING_FEN;

		// Filtered on by the matchmaker (see app.config.ts) so joinOrCreate only
		// pairs players who asked for the same clock and rating band.
		this.metadata = {
			timeControl: this.timeControl.id,
			ranked: this.state.ranked,
			ratingBucket: Number(options.ratingBucket ?? 0),
			status: "waiting",
		};
	}

	async onJoin(client: ChessClient, options: JoinOptions, auth: AuthUser) {
		// Same human on two tabs would otherwise play themselves and farm rating.
		let duplicate = false;
		this.state.players.forEach((player) => {
			if (player.userId === auth.id) duplicate = true;
		});
		if (duplicate) throw new ServerError(4101, "already_in_this_game");

		// A block keeps two people out of each other's games. The seat is not
		// taken yet, so refusing here leaves the waiting player where they were
		// and the client opens a room of its own instead.
		for (const seated of this.seats.values()) {
			if (await areBlocked(seated.id, auth.id)) {
				throw new ServerError(4103, "blocked");
			}
		}

		// Every clock has its own rating: a bullet game and a rapid game are
		// not measuring the same thing, so they must not move the same number.
		// From here on `seated` carries the rating actually at stake in this
		// room, and everything downstream — the bucket check, the seat, the
		// stored before-rating and the Elo maths — reads it without knowing that
		// pools exist.
		const pool = auth.ratings[this.timeControl.category];
		const seated: AuthUser = {
			...auth,
			rating: pool.rating,
			deviation: pool.deviation,
			volatility: pool.volatility,
			gamesPlayed: pool.gamesPlayed,
		};

		// The bucket is a client-supplied matchmaking hint; verify it against the
		// rating in the signed token so nobody can sandbag into a weak pool.
		if (this.state.ranked) {
			const claimed = Number(
				options.ratingBucket ?? this.metadata?.ratingBucket ?? 0,
			);
			if (
				Math.abs(claimed - ratingBucketOf(seated.rating)) > MAX_BUCKET_SPREAD
			) {
				throw new ServerError(4102, "rating_bucket_mismatch");
			}
		}

		const color: Color =
			this.state.players.size === 0
				? Math.random() < 0.5
					? "w"
					: "b"
				: this.firstPlayerColor() === "w"
					? "b"
					: "w";

		const player = new PlayerState();
		player.userId = auth.id;
		player.username = auth.username;
		player.name = auth.name;
		player.country = auth.country ?? "";
		player.flair = auth.flair ?? "";
		player.image = auth.image ?? "";
		player.color = color;
		player.rating = Math.round(seated.rating);
		player.timeLeftMs = this.timeControl.initialMs;
		player.connected = true;

		this.state.players.set(client.sessionId, player);
		this.seats.set(client.sessionId, seated);
		client.userData = { userId: auth.id, color };

		if (color === "w") this.state.whiteSessionId = client.sessionId;
		else this.state.blackSessionId = client.sessionId;

		if (this.state.players.size === 2) this.startGame();
	}

	async onDrop(client: ChessClient) {
		const player = this.state.players.get(client.sessionId);
		if (!player) return;

		player.connected = false;

		if (this.state.status !== "playing") {
			// Nothing at stake yet — let them go and free the seat.
			this.releaseSeat(client.sessionId);
			return;
		}

		this.broadcast(
			ServerMessage.OpponentDropped,
			{ color: player.color, reconnectWindowSeconds: RECONNECT_WINDOW_SECONDS },
			{ except: client },
		);

		try {
			await this.allowReconnection(client, RECONNECT_WINDOW_SECONDS);
		} catch {
			if (this.state.status !== "playing") return;
			if (this.state.ply < MIN_PLY_FOR_RATED_RESULT) {
				this.endGame("*", "aborted");
			} else {
				this.endGame(player.color === "w" ? "0-1" : "1-0", "abandonment");
			}
		}
	}

	onReconnect(client: ChessClient) {
		const player = this.state.players.get(client.sessionId);
		if (!player) return;
		player.connected = true;
		this.broadcast(
			ServerMessage.OpponentReturned,
			{ color: player.color },
			{ except: client },
		);
	}

	onLeave(client: ChessClient) {
		// Reached on a consented `room.leave()`. Walking out of a live game is a
		// resignation; walking out of the lobby just frees the seat.
		const player = this.state.players.get(client.sessionId);
		if (!player) return;

		player.connected = false;

		if (this.state.status === "playing") {
			if (this.state.ply < MIN_PLY_FOR_RATED_RESULT)
				this.endGame("*", "aborted");
			else this.endGame(player.color === "w" ? "0-1" : "1-0", "resignation");
			return;
		}

		if (this.state.status === "waiting") this.releaseSeat(client.sessionId);
	}

	onBeforeShutdown() {
		if (this.state.status === "playing") {
			// Unfinished and unrated. Persist it so you can offer a resume/adjourn
			// flow rather than silently losing the game.
			this.endGame("*", "server_shutdown");
		}
		this.broadcast(ServerMessage.Notice, { code: "server_restarting" });
		this.clock.setTimeout(() => this.disconnect(), 10_000);
	}

	async onDispose() {
		this.clockInterval?.clear();
		this.disposeTimer?.clear();
		if (this.state.status === "playing") {
			await this.persistGame("*", "aborted", null);
		}
	}

	onUncaughtException(err: Error, methodName: string) {
		console.error(`[ChessRoom ${this.roomId}] ${methodName} threw`, err);
		// Never leave a half-updated game running: end it unrated and let clients out.
		if (this.state.status === "playing") this.endGame("*", "aborted");
	}

	// ------------------------------------------------------------- game flow

	private startGame() {
		this.state.status = "playing";
		this.state.turn = "w";
		this.state.turnStartedAt = this.clock.currentTime;
		this.lastMoveAt = this.clock.currentTime;
		this.startedAt = Date.now();
		this.persisted = false;
		this.moveLog = [];

		void this.createGameRow();

		this.clockInterval?.clear();
		this.clockInterval = this.clock.setInterval(
			() => this.tickClock(),
			CLOCK_TICK_MS,
		);

		void this.setMatchmaking({
			locked: true,
			metadata: { ...this.metadata, status: "playing" },
		});

		this.broadcast(ServerMessage.GameStart, {
			gameId: this.state.gameId,
			white: this.state.whiteSessionId,
			black: this.state.blackSessionId,
			initialTimeMs: this.state.initialTimeMs,
			incrementMs: this.state.incrementMs,
			ranked: this.state.ranked,
		});
	}

	private handleMove(
		client: ChessClient,
		payload: z.infer<typeof MoveMessage>,
	) {
		const player = this.state.players.get(client.sessionId);
		if (!player) return this.rejectMove(client, "not_a_player");
		if (this.state.status !== "playing")
			return this.rejectMove(client, "game_not_active");
		if (player.color !== this.state.turn)
			return this.rejectMove(client, "not_your_turn");

		// Charge thinking time before validating: a move that arrives after the
		// flag has already fallen must not count.
		this.consumeClock();
		if (this.state.status !== "playing") return;

		const move = this.tryMove(payload);
		if (!move) return this.rejectMove(client, "illegal_move");

		player.timeLeftMs += this.state.incrementMs;
		this.syncPosition(move);
		this.recordMove(move, player);
		this.clearDrawOffers();

		const outcome = this.evaluateOutcome();
		if (outcome) {
			this.endGame(outcome.result, outcome.reason);
			return;
		}

		this.state.turn = this.chess.turn();
		this.state.turnStartedAt = this.clock.currentTime;
	}

	private tryMove(payload: z.infer<typeof MoveMessage>): Move | null {
		const from = payload.from as Square;
		const to = payload.to as Square;
		try {
			return this.chess.move({ from, to, promotion: payload.promotion });
		} catch {
			// chess.js throws on an illegal move. A pawn reaching the last rank
			// without an explicit piece is the one case worth retrying.
			if (payload.promotion) return null;
			try {
				return this.chess.move({ from, to, promotion: "q" });
			} catch {
				return null;
			}
		}
	}

	private syncPosition(move: Move) {
		this.state.fen = this.chess.fen();
		this.state.ply = this.chess.history().length;
		this.state.history.push(move.san);
		this.state.lastMoveFrom = move.from;
		this.state.lastMoveTo = move.to;
		this.state.inCheck = this.chess.inCheck();
	}

	private recordMove(move: Move, player: PlayerState) {
		const now = this.clock.currentTime;
		const thinkMs = Math.max(0, now - this.lastMoveAt);
		this.state.thinkMs.push(thinkMs);
		this.moveLog.push({
			ply: this.state.ply,
			color: player.color as Color,
			san: move.san,
			from: move.from,
			to: move.to,
			promotion: move.promotion,
			fenAfter: this.state.fen,
			clockMs: player.timeLeftMs,
			thinkMs,
		});
		this.lastMoveAt = now;
	}

	private async createGameRow() {
		const white = this.userForColor("w");
		const black = this.userForColor("b");
		if (!white || !black) return;

		try {
			await this.store.createGame({
				gameId: this.state.gameId,
				roomId: this.roomId,
				timeControl: this.state.timeControl,
				initialTimeMs: this.state.initialTimeMs,
				incrementMs: this.state.incrementMs,
				ranked: this.state.ranked,
				whiteUserId: white.id,
				blackUserId: black.id,
				whiteRating: Math.round(white.rating),
				blackRating: Math.round(black.rating),
				startedAt: this.startedAt,
			});
		} catch (err) {
			// The game is playable without a row; log loudly and reconcile at the end.
			console.error(
				`[ChessRoom ${this.roomId}] failed to create game row`,
				err,
			);
		}
	}

	private evaluateOutcome(): { result: GameResult; reason: EndReason } | null {
		if (this.chess.isCheckmate()) {
			// The side to move is the one that got mated.
			return {
				result: this.chess.turn() === "w" ? "0-1" : "1-0",
				reason: "checkmate",
			};
		}
		if (this.chess.isStalemate())
			return { result: "1/2-1/2", reason: "stalemate" };
		if (this.chess.isInsufficientMaterial())
			return { result: "1/2-1/2", reason: "insufficient_material" };
		if (this.chess.isThreefoldRepetition())
			return { result: "1/2-1/2", reason: "threefold_repetition" };
		if (halfmoveClock(this.chess.fen()) >= 100)
			return { result: "1/2-1/2", reason: "fifty_move_rule" };
		return null;
	}

	// ---------------------------------------------------------------- clock

	/** Charges the side to move for the time elapsed since the last checkpoint. */
	private consumeClock() {
		if (this.state.status !== "playing") return;
		const active = this.playerByColor(this.state.turn as Color);
		if (!active) return;

		const now = this.clock.currentTime;
		const elapsed = Math.max(0, now - this.state.turnStartedAt);
		active.timeLeftMs = Math.max(0, active.timeLeftMs - elapsed);
		this.state.turnStartedAt = now;

		if (active.timeLeftMs === 0) this.flag(active);
	}

	private tickClock() {
		this.consumeClock();
	}

	private flag(flagged: PlayerState) {
		const opponent = this.playerByColor(flagged.color === "w" ? "b" : "w");

		// FIDE: if the opponent cannot possibly mate, a flag is a draw, not a win.
		if (!opponent || !hasMatingMaterial(this.chess, opponent.color as Color)) {
			this.endGame("1/2-1/2", "timeout_vs_insufficient_material");
			return;
		}
		this.endGame(flagged.color === "w" ? "0-1" : "1-0", "timeout");
	}

	// --------------------------------------------------- resign / draw / abort

	private handleResign(client: ChessClient) {
		const player = this.state.players.get(client.sessionId);
		if (!player || this.state.status !== "playing") return;
		this.endGame(player.color === "w" ? "0-1" : "1-0", "resignation");
	}

	private handleAbort(client: ChessClient) {
		const player = this.state.players.get(client.sessionId);
		if (!player || this.state.status !== "playing") return;
		if (this.state.ply >= MIN_PLY_FOR_RATED_RESULT) return; // too late to abort
		this.endGame("*", "aborted");
	}

	private handleDrawOffer(client: ChessClient) {
		const player = this.state.players.get(client.sessionId);
		if (!player || this.state.status !== "playing") return;
		if (player.offeringDraw) return;

		player.offeringDraw = true;
		this.broadcast(
			ServerMessage.DrawOffered,
			{ color: player.color },
			{ except: client },
		);
	}

	private handleDrawAccept(client: ChessClient) {
		const player = this.state.players.get(client.sessionId);
		if (!player || this.state.status !== "playing") return;

		const opponent = this.playerByColor(player.color === "w" ? "b" : "w");
		if (!opponent?.offeringDraw) return;

		this.endGame("1/2-1/2", "agreement");
	}

	private handleDrawDecline(client: ChessClient) {
		const player = this.state.players.get(client.sessionId);
		if (!player) return;
		const opponent = this.playerByColor(player.color === "w" ? "b" : "w");
		if (!opponent?.offeringDraw) return;

		opponent.offeringDraw = false;
		this.broadcast(
			ServerMessage.DrawDeclined,
			{ color: player.color },
			{ except: client },
		);
	}

	private clearDrawOffers() {
		this.state.players.forEach((player) => {
			player.offeringDraw = false;
		});
	}

	// -------------------------------------------------------------- rematch

	private handleRematch(client: ChessClient, wants: boolean) {
		const player = this.state.players.get(client.sessionId);
		if (!player || this.state.status !== "finished") return;
		if (this.state.players.size < 2) return;

		player.wantsRematch = wants;

		let agreed = true;
		this.state.players.forEach((p) => {
			if (!p.wantsRematch || !p.connected) agreed = false;
		});
		if (agreed) this.resetForRematch();
	}

	private resetForRematch() {
		this.disposeTimer?.clear();
		this.disposeTimer = undefined;

		// A rematch reuses the room, and the seats are what the next game is rated
		// from. Without this the second game starts both players on the ratings
		// they walked in with, so the first result is silently thrown away — and
		// so is the rating deviation, which is the part Glicko-2 uses to decide
		// how much the second game should count.
		if (this.lastRatings) {
			for (const [sessionId, user] of this.seats) {
				const change = this.lastRatings.find((r) => r.userId === user.id);
				if (!change) continue;

				this.seats.set(sessionId, {
					...user,
					rating: change.after,
					deviation: change.deviation,
					volatility: change.volatility,
					gamesPlayed: user.gamesPlayed + 1,
				});
			}
			this.lastRatings = null;
		}

		this.chess = new Chess();
		this.state.gameId = randomUUID();
		this.state.fen = STARTING_FEN;
		this.state.history.clear();
		this.state.thinkMs.clear();
		this.state.lastMoveFrom = "";
		this.state.lastMoveTo = "";
		this.state.ply = 0;
		this.state.inCheck = false;
		this.state.result = "";
		this.state.reason = "";
		this.state.winnerColor = "";

		// Swap colours, as you would over the board.
		const white = this.state.whiteSessionId;
		this.state.whiteSessionId = this.state.blackSessionId;
		this.state.blackSessionId = white;

		this.state.players.forEach((player, sessionId) => {
			player.color = sessionId === this.state.whiteSessionId ? "w" : "b";
			player.timeLeftMs = this.state.initialTimeMs;
			player.offeringDraw = false;
			player.wantsRematch = false;
		});

		this.startGame();
	}

	// ------------------------------------------------------------- finishing

	private endGame(result: GameResult, reason: EndReason) {
		if (this.state.status === "finished") return;

		this.clockInterval?.clear();
		this.clockInterval = undefined;

		this.state.status = "finished";
		this.state.result = result;
		this.state.reason = reason;
		this.state.winnerColor =
			result === "1-0" ? "w" : result === "0-1" ? "b" : "";
		this.clearDrawOffers();

		const ratings = this.rateGame(result);
		this.lastRatings = ratings;
		const pgn = this.chess.pgn();

		this.broadcast(ServerMessage.GameOver, {
			gameId: this.state.gameId,
			result,
			reason,
			winnerColor: this.state.winnerColor || null,
			pgn,
			ratings,
		});

		if (ratings) {
			this.state.players.forEach((player) => {
				const change = ratings.find((r) => r.userId === player.userId);
				if (change) player.rating = change.after;
			});
		}

		void this.setMatchmaking({
			locked: true,
			unlisted: true,
			metadata: { ...this.metadata, status: "finished" },
		});
		void this.persistGame(result, reason, ratings);

		this.disposeTimer?.clear();
		this.disposeTimer = this.clock.setTimeout(
			() => this.disconnect(),
			POST_GAME_LINGER_MS,
		);
	}

	private rateGame(result: GameResult): RatingDelta[] | null {
		if (!this.state.ranked || result === "*") return null;
		if (this.state.ply < MIN_PLY_FOR_RATED_RESULT) return null;

		const white = this.userForColor("w");
		const black = this.userForColor("b");
		if (!white || !black) return null;

		const changes = computeRatingChanges(
			{
				userId: white.id,
				rating: white.rating,
				deviation: white.deviation,
				volatility: white.volatility,
			},
			{
				userId: black.id,
				rating: black.rating,
				deviation: black.deviation,
				volatility: black.volatility,
			},
			result,
		);
		return changes ? [...changes] : null;
	}

	private async persistGame(
		result: GameResult,
		reason: EndReason,
		ratings: RatingDelta[] | null,
	) {
		if (this.persisted) return;
		this.persisted = true;

		const white = this.userForColor("w");
		const black = this.userForColor("b");
		if (!white || !black) return;

		const record: GameRecord = {
			gameId: this.state.gameId,
			roomId: this.roomId,
			timeControl: this.state.timeControl,
			initialTimeMs: this.state.initialTimeMs,
			incrementMs: this.state.incrementMs,
			ranked: this.state.ranked,
			whiteUserId: white.id,
			blackUserId: black.id,
			whiteRating: Math.round(white.rating),
			blackRating: Math.round(black.rating),
			result,
			reason,
			winnerColor: this.state.winnerColor as "w" | "b" | "",
			moves: Array.from(this.state.history).join(" "),
			finalFen: this.state.fen,
			pgn: this.chess.pgn(),
			ply: this.state.ply,
			moveLog: this.moveLog,
			startedAt: this.startedAt,
			endedAt: Date.now(),
			ratings,
		};

		try {
			await this.store.saveGame(record);
			if (ratings)
				await this.store.applyRatingChanges(this.state.gameId, ratings);
		} catch (err) {
			// Losing a result row must never take the room down mid-broadcast.
			console.error(`[ChessRoom ${this.roomId}] failed to persist game`, err);
		}
	}

	// --------------------------------------------------------------- helpers

	private rejectMove(client: ChessClient, reason: MoveRejectedReason) {
		client.send(ServerMessage.MoveRejected, { reason, fen: this.state.fen });
	}

	private playerByColor(color: Color): PlayerState | undefined {
		const sessionId =
			color === "w" ? this.state.whiteSessionId : this.state.blackSessionId;
		return this.state.players.get(sessionId);
	}

	private userForColor(color: Color): AuthUser | undefined {
		const sessionId =
			color === "w" ? this.state.whiteSessionId : this.state.blackSessionId;
		return this.seats.get(sessionId);
	}

	private firstPlayerColor(): Color {
		let color: Color = "w";
		this.state.players.forEach((player) => {
			color = player.color as Color;
		});
		return color;
	}

	private releaseSeat(sessionId: string) {
		this.state.players.delete(sessionId);
		this.seats.delete(sessionId);
		if (this.state.whiteSessionId === sessionId) this.state.whiteSessionId = "";
		if (this.state.blackSessionId === sessionId) this.state.blackSessionId = "";
	}
}

/** Halfmove clock from a FEN — 100 plies without a capture or pawn move is a draw. */
function halfmoveClock(fen: string): number {
	const value = Number(fen.split(" ")[4]);
	return Number.isFinite(value) ? value : 0;
}

/**
 * Can `color` still deliver mate? Bare king, king + single minor cannot.
 * Used for the flag rule; matches how the major chess sites score it.
 */
function hasMatingMaterial(chess: Chess, color: Color): boolean {
	let minors = 0;
	for (const row of chess.board()) {
		for (const square of row) {
			if (!square || square.color !== color) continue;
			if (square.type === "p" || square.type === "r" || square.type === "q")
				return true;
			if (square.type === "b" || square.type === "n") minors += 1;
		}
	}
	return minors >= 2;
}
