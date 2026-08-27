import type { Color, EndReason, GameResult, GameStatus } from "./protocol";

/**
 * The room state, flattened into plain objects. Schema instances are mutated
 * in place by the SDK, so React would not see a change if we stored them
 * directly — every render reads from one of these immutable snapshots.
 */
export interface PlayerSnapshot {
	sessionId: string;
	userId: string;
	username: string;
	name: string;
	/** ISO 3166-1 alpha-2, or "" when unset. */
	country: string;
	/** Flair catalogue id, or "" when they wear none. */
	flair: string;
	image: string;
	color: Color;
	rating: number;
	timeLeftMs: number;
	connected: boolean;
	offeringDraw: boolean;
	wantsRematch: boolean;
}

export interface ChessStateSnapshot {
	gameId: string;
	status: GameStatus;
	fen: string;
	turn: Color;
	ply: number;
	inCheck: boolean;
	history: string[];
	/** Think time per half-move, aligned with `history`. */
	thinkMs: number[];
	lastMoveFrom: string;
	lastMoveTo: string;
	players: PlayerSnapshot[];
	whiteSessionId: string;
	blackSessionId: string;
	timeControl: string;
	initialTimeMs: number;
	incrementMs: number;
	ranked: boolean;
	result: GameResult | "";
	reason: EndReason | "";
	winnerColor: Color | "";
}

/** Schema -> plain object. Called on every patch, so keep it cheap. */
export function toSnapshot(state: any): ChessStateSnapshot {
	const players: PlayerSnapshot[] = [];
	state.players?.forEach((player: any, sessionId: string) => {
		players.push({
			sessionId,
			userId: player.userId,
			username: player.username,
			name: player.name,
			country: player.country,
			flair: player.flair,
			image: player.image,
			color: player.color,
			rating: player.rating,
			timeLeftMs: player.timeLeftMs,
			connected: player.connected,
			offeringDraw: player.offeringDraw,
			wantsRematch: player.wantsRematch,
		});
	});

	return {
		gameId: state.gameId,
		status: state.status,
		fen: state.fen,
		turn: state.turn,
		ply: state.ply,
		inCheck: state.inCheck,
		history: Array.from(state.history ?? []),
		thinkMs: Array.from(state.thinkMs ?? []),
		lastMoveFrom: state.lastMoveFrom,
		lastMoveTo: state.lastMoveTo,
		players,
		whiteSessionId: state.whiteSessionId,
		blackSessionId: state.blackSessionId,
		timeControl: state.timeControl,
		initialTimeMs: state.initialTimeMs,
		incrementMs: state.incrementMs,
		ranked: state.ranked,
		result: state.result,
		reason: state.reason,
		winnerColor: state.winnerColor,
	};
}
