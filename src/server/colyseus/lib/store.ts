import { eq, sql } from "drizzle-orm";
import type { EndReason, GameResult } from "../../../lib/protocol";
import { resolveTimeControl } from "../../../lib/timeControls";
import { db } from "../../db";
import { applyPoolDelta } from "../../db/ratings";
import { games, gamesHistory, users } from "../../db/schema";
import type { RatingDelta } from "./glicko";

export interface MoveRecord {
	ply: number;
	color: "w" | "b";
	san: string;
	from: string;
	to: string;
	promotion?: string;
	fenAfter: string;
	/** Mover's clock after the increment was credited. */
	clockMs: number;
	/** Time spent on this move. */
	thinkMs: number;
}

/** Written when both seats fill, so in-progress games are visible in the app. */
interface PendingGame {
	gameId: string;
	roomId: string;
	timeControl: string;
	initialTimeMs: number;
	incrementMs: number;
	ranked: boolean;
	whiteUserId: string;
	blackUserId: string;
	whiteRating: number;
	blackRating: number;
	startedAt: number;
}

export interface GameRecord extends PendingGame {
	result: GameResult;
	reason: EndReason;
	winnerColor: "w" | "b" | "";
	/** Space-separated SAN. */
	moves: string;
	finalFen: string;
	pgn: string;
	ply: number;
	moveLog: MoveRecord[];
	endedAt: number;
	ratings: RatingDelta[] | null;
}

export interface GameStore {
	createGame(game: PendingGame): Promise<void>;
	saveGame(record: GameRecord): Promise<void>;
	/** Must be idempotent per gameId — a retried save must not double-apply Elo. */
	applyRatingChanges(gameId: string, ratings: RatingDelta[]): Promise<void>;
}

/* ------------------------------------------------------------------ drizzle */

const drizzleStore: GameStore = {
	async createGame(game) {
		await db
			.insert(games)
			.values({
				id: game.gameId,
				roomId: game.roomId,
				timeControl: game.timeControl,
				initialTimeMs: game.initialTimeMs,
				incrementMs: game.incrementMs,
				ranked: game.ranked,
				whiteUserId: game.whiteUserId,
				blackUserId: game.blackUserId,
				whiteRatingBefore: game.whiteRating,
				blackRatingBefore: game.blackRating,
				status: "playing",
				startedAt: new Date(game.startedAt),
			})
			// A rematch reuses the room, and a retry can re-run this: keep it a no-op.
			.onDuplicateKeyUpdate({ set: { roomId: game.roomId } });
	},

	async saveGame(record) {
		const white = record.ratings?.find((r) => r.userId === record.whiteUserId);
		const black = record.ratings?.find((r) => r.userId === record.blackUserId);

		const row = {
			status: (record.result === "*" ? "aborted" : "finished") as
				| "aborted"
				| "finished",
			result: record.result,
			reason: record.reason,
			winnerColor: record.winnerColor || null,
			moves: record.moves,
			finalFen: record.finalFen,
			pgn: record.pgn,
			ply: record.ply,
			whiteRatingDelta: white?.delta ?? null,
			blackRatingDelta: black?.delta ?? null,
			endedAt: new Date(record.endedAt),
		};

		await db
			.insert(games)
			.values({
				id: record.gameId,
				roomId: record.roomId,
				timeControl: record.timeControl,
				initialTimeMs: record.initialTimeMs,
				incrementMs: record.incrementMs,
				ranked: record.ranked,
				whiteUserId: record.whiteUserId,
				blackUserId: record.blackUserId,
				whiteRatingBefore: record.whiteRating,
				blackRatingBefore: record.blackRating,
				startedAt: new Date(record.startedAt),
				...row,
			})
			.onDuplicateKeyUpdate({ set: row });

		if (record.moveLog.length > 0) {
			// Chunked: a 300-move blitz game would otherwise build one enormous
			// statement, and max_allowed_packet is not worth discovering in prod.
			for (let i = 0; i < record.moveLog.length; i += 100) {
				const chunk = record.moveLog.slice(i, i + 100);
				await db
					.insert(gamesHistory)
					.values(
						chunk.map((move) => ({
							gameId: record.gameId,
							ply: move.ply,
							color: move.color,
							san: move.san,
							fromSquare: move.from,
							toSquare: move.to,
							promotion: move.promotion ?? null,
							fenAfter: move.fenAfter,
							clockMs: move.clockMs,
							thinkMs: move.thinkMs,
						})),
					)
					.onDuplicateKeyUpdate({ set: { fenAfter: sql`values(fen_after)` } });
			}
		}
	},

	async applyRatingChanges(gameId, ratings) {
		await db.transaction(async (tx) => {
			const [row] = await tx
				.select({
					ratingsApplied: games.ratingsApplied,
					timeControl: games.timeControl,
				})
				.from(games)
				.where(eq(games.id, gameId))
				.for("update")
				.limit(1);

			// Either the row vanished or Elo was already applied — both mean stop.
			if (!row || row.ratingsApplied) return;

			// The pool is read back off the game rather than passed in: the row is
			// the only thing that still knows what was played once the room is
			// gone, so a retry can never land a blitz result in the rapid pool.
			const { category } = resolveTimeControl(row.timeControl);

			for (const change of ratings) {
				await applyPoolDelta(tx, change.userId, category, change);

				await tx
					.update(users)
					.set({ gamesPlayed: sql`${users.gamesPlayed} + 1` })
					.where(eq(users.id, change.userId));
			}

			await tx
				.update(games)
				.set({ ratingsApplied: true })
				.where(eq(games.id, gameId));
		});
	},
};

/* ------------------------------------------------------------- no-database */

const loggingStore: GameStore = {
	async createGame(game) {
		console.log("[store] game started", game.gameId);
	},
	async saveGame(record) {
		console.log(
			"[store] game finished",
			record.gameId,
			record.result,
			record.reason,
		);
	},
	async applyRatingChanges(gameId, ratings) {
		console.log("[store] rating changes", gameId, ratings);
	},
};

export function getGameStore(): GameStore {
	// No database configured (local experiments, the test suite): log instead of
	// writing. `db` throws on use in that mode, so this is the only guard needed.
	if (!process.env.DATABASE_URL) return loggingStore;
	return drizzleStore;
}
