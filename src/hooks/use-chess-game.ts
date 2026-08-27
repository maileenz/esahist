"use client";

import type { Room } from "@colyseus/sdk";
import { Chess, type Square } from "chess.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	type ChessStateSnapshot,
	type PlayerSnapshot,
	toSnapshot,
} from "../lib/chessTypes";
import {
	forgetSession,
	getGameClient,
	matchmake,
	rememberSession,
	resumeSession,
} from "../lib/colyseus";
import {
	ClientMessage,
	type Color,
	type GameOverPayload,
	type MoveRejectedPayload,
	ServerMessage,
} from "../lib/protocol";

export type ConnectionPhase =
	| "idle"
	| "searching"
	| "waiting"
	| "playing"
	| "over"
	| "error";

export interface UseChessGameOptions {
	timeControl: string;
	/**
	 * Used only to pick a matchmaking bucket. Pass the value from the session —
	 * the server re-derives it from the database and rejects a mismatch, so a
	 * stale or edited number cannot get anyone into the wrong pool.
	 */
	rating: number;
	ranked?: boolean;
	/**
	 * How many neighbouring rating buckets to search. Must stay within the room's
	 * `MAX_BUCKET_SPREAD`, or ranked joins come back as `rating_bucket_mismatch`.
	 */
	spread?: number;
	/** Leave false to render a lobby first and call `findGame()` yourself. */
	autoJoin?: boolean;
}

export function useChessGame({
	timeControl,
	rating,
	ranked = true,
	spread = 1,
	autoJoin = false,
}: UseChessGameOptions) {
	const [phase, setPhase] = useState<ConnectionPhase>("idle");
	const [error, setError] = useState<string | null>(null);
	/** Transient feedback (a rejected move); cleared on the next patch. */
	const [notice, setNotice] = useState<string | null>(null);
	const [snapshot, setSnapshot] = useState<ChessStateSnapshot | null>(null);
	const [sessionId, setSessionId] = useState<string | null>(null);
	const [gameOver, setGameOver] = useState<GameOverPayload | null>(null);
	const [drawOfferFrom, setDrawOfferFrom] = useState<Color | null>(null);
	const [opponentOnline, setOpponentOnline] = useState(true);

	const roomRef = useRef<Room | null>(null);
	const chessRef = useRef(new Chess());
	/** Position shown while the server has not yet confirmed our move. */
	const [optimisticFen, setOptimisticFen] = useState<string | null>(null);
	/** Wall-clock reading of the last patch, used to smooth the countdown. */
	const patchedAtRef = useRef(Date.now());

	/** Back to a clean lobby: everything a new search would otherwise inherit. */
	const reset = useCallback(() => {
		setSnapshot(null);
		setSessionId(null);
		setGameOver(null);
		setDrawOfferFrom(null);
		setOptimisticFen(null);
		setOpponentOnline(true);
		setNotice(null);
		setError(null);
		chessRef.current = new Chess();
		setPhase("idle");
	}, []);

	/**
	 * Consented leave. Mid-game the server scores this as a resignation; while
	 * waiting it just frees the seat and the empty room disposes itself.
	 */
	const leave = useCallback(() => {
		forgetSession();
		void roomRef.current?.leave();
		roomRef.current = null;
		reset();
	}, [reset]);

	const attach = useCallback((room: Room) => {
		roomRef.current = room;
		setSessionId(room.sessionId);
		rememberSession(room.roomId, room.reconnectionToken);

		room.onStateChange((state) => {
			const next = toSnapshot(state);
			patchedAtRef.current = Date.now();
			setSnapshot(next);
			setOptimisticFen(null);
			setNotice(null);
			chessRef.current.load(next.fen);
			rememberSession(room.roomId, room.reconnectionToken);
			setPhase(
				next.status === "waiting"
					? "waiting"
					: next.status === "playing"
						? "playing"
						: "over",
			);
		});

		room.onMessage(
			ServerMessage.MoveRejected,
			(payload: MoveRejectedPayload) => {
				// Server is authoritative: snap back to its position.
				setOptimisticFen(null);
				chessRef.current.load(payload.fen);
				if (payload.reason === "illegal_move")
					setNotice("That move isn't legal.");
			},
		);

		room.onMessage(ServerMessage.DrawOffered, ({ color }: { color: Color }) =>
			setDrawOfferFrom(color),
		);
		room.onMessage(ServerMessage.DrawDeclined, () => setDrawOfferFrom(null));
		room.onMessage(ServerMessage.GameOver, (payload: GameOverPayload) => {
			setGameOver(payload);
			setDrawOfferFrom(null);
			forgetSession();
		});
		room.onMessage(ServerMessage.OpponentDropped, () =>
			setOpponentOnline(false),
		);
		room.onMessage(ServerMessage.OpponentReturned, () =>
			setOpponentOnline(true),
		);

		room.onError((_code, message) => {
			setError(message ?? "Connection error");
			setPhase("error");
		});
		room.onLeave(() => {
			roomRef.current = null;
		});
	}, []);

	const findGame = useCallback(async () => {
		if (roomRef.current) return;
		setError(null);
		setNotice(null);
		setGameOver(null);

		try {
			const client = getGameClient();

			// A refresh mid-game should put you back on the same board.
			const resumed = await resumeSession(client);
			if (resumed) {
				attach(resumed);
				return;
			}

			// No token handling: the SDK sends matchmaking requests with
			// `credentials: "include"`, so the httpOnly session cookie rides along
			// and `onAuth` resolves it against the database.
			setPhase("searching");
			const room = await matchmake(client, {
				timeControl,
				ranked,
				rating,
				spread,
			});
			attach(room);
		} catch (err) {
			setPhase("error");
			const message = err instanceof Error ? err.message : "";
			setError(
				/401|unauthorized/i.test(message)
					? "Your session has expired — please sign in again."
					: "Could not find a game. Check your connection and try again.",
			);
		}
	}, [attach, ranked, rating, spread, timeControl]);

	/** Give up on the queue and go back to the lobby. */
	const cancelSearch = useCallback(() => {
		leave();
	}, [leave]);

	// Joining is a one-shot on mount; re-running it when the settings change
	// would queue a second room.
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentional one-shot
	useEffect(() => {
		if (autoJoin) void findGame();
		return () => {
			void roomRef.current?.leave(false); // unconsented: keep the seat for a refresh
			roomRef.current = null;
		};
	}, [autoJoin]);

	// -------------------------------------------------------------- derived

	const me = useMemo<PlayerSnapshot | null>(
		() => snapshot?.players.find((p) => p.sessionId === sessionId) ?? null,
		[snapshot, sessionId],
	);
	const opponent = useMemo<PlayerSnapshot | null>(
		() => snapshot?.players.find((p) => p.sessionId !== sessionId) ?? null,
		[snapshot, sessionId],
	);

	const myColor = me?.color ?? null;
	const position = optimisticFen ?? snapshot?.fen ?? chessRef.current.fen();
	const isMyTurn = Boolean(
		snapshot &&
			myColor &&
			snapshot.status === "playing" &&
			snapshot.turn === myColor,
	);

	/** Target squares for a piece, for highlighting. */
	// `position` is not read directly — it is the signal that the mutable
	// chess.js instance has moved on.
	// biome-ignore lint/correctness/useExhaustiveDependencies: deliberate extra dep
	const legalMovesFrom = useCallback(
		(square: string): string[] => {
			if (!isMyTurn) return [];
			try {
				return chessRef.current
					.moves({ square: square as Square, verbose: true })
					.map((move) => move.to);
			} catch {
				return [];
			}
		},
		[isMyTurn, position],
	);

	const makeMove = useCallback(
		(from: string, to: string, promotion?: "q" | "r" | "b" | "n"): boolean => {
			const room = roomRef.current;
			if (!room || !isMyTurn) return false;

			// Validate locally first so an obviously bad drag never hits the wire,
			// then show the result immediately and let the server confirm it.
			try {
				chessRef.current.move({
					from: from as Square,
					to: to as Square,
					promotion: promotion ?? "q",
				});
			} catch {
				return false;
			}

			setOptimisticFen(chessRef.current.fen());
			room.send(ClientMessage.Move, { from, to, promotion });
			return true;
		},
		[isMyTurn],
	);

	const send = useCallback((type: string) => roomRef.current?.send(type), []);

	const clocks = useInterpolatedClocks(snapshot, patchedAtRef);

	return {
		phase,
		error,
		notice,
		state: snapshot,
		me,
		opponent,
		myColor,
		position,
		isMyTurn,
		gameOver,
		drawOfferFrom,
		opponentOnline,
		/** True while the opponent's seat is still empty. */
		isWaitingForOpponent: snapshot?.status === "waiting",

		findGame,
		cancelSearch,
		makeMove,
		legalMovesFrom,
		resign: () => send(ClientMessage.Resign),
		abort: () => send(ClientMessage.Abort),
		offerDraw: () => send(ClientMessage.OfferDraw),
		acceptDraw: () => send(ClientMessage.AcceptDraw),
		declineDraw: () => send(ClientMessage.DeclineDraw),
		requestRematch: () => send(ClientMessage.Rematch),
		leave,

		/** Live clock readings by sessionId, interpolated between server ticks. */
		clocks,
	};
}

export type ChessGameApi = ReturnType<typeof useChessGame>;

/**
 * The server ticks the clock every 200ms; this fills the gaps so the countdown
 * looks continuous without ever letting the client decide who flagged.
 */
function useInterpolatedClocks(
	snapshot: ChessStateSnapshot | null,
	patchedAtRef: React.RefObject<number>,
): Record<string, number> {
	const [, force] = useState(0);

	useEffect(() => {
		if (snapshot?.status !== "playing") return;
		const id = setInterval(() => force((n) => n + 1), 100);
		return () => clearInterval(id);
	}, [snapshot?.status]);

	const clocks: Record<string, number> = {};
	if (!snapshot) return clocks;

	const elapsed =
		snapshot.status === "playing" ? Date.now() - patchedAtRef.current : 0;
	for (const player of snapshot.players) {
		const running =
			snapshot.status === "playing" && player.color === snapshot.turn;
		clocks[player.sessionId] = Math.max(
			0,
			player.timeLeftMs - (running ? elapsed : 0),
		);
	}
	return clocks;
}

export function formatClock(ms: number): string {
	const total = Math.ceil(ms / 1000);
	const minutes = Math.floor(total / 60);
	const seconds = total % 60;
	if (ms < 10_000)
		return `${minutes}:${seconds.toString().padStart(2, "0")}.${Math.floor((ms % 1000) / 100)}`;
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
