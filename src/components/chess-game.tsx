"use client";

import { useTranslations } from "next-intl";
import { Chessboard } from "react-chessboard";
import { BoardColumn } from "@/components/board-layout";
import MoveList from "@/components/move-list";
import { PlayerBar } from "@/components/player-bar";
import { Button } from "@/components/ui/button";
import { STARTING_FEN, useBoardStyles } from "@/hooks/use-board-styles";
import type { ChessGameApi } from "@/hooks/use-chess-game";
import { capturedFrom } from "@/lib/captured";
import type { PlayerSnapshot } from "@/lib/chessTypes";
import { confirmDestructive } from "@/lib/sweet-alert";

/**
 * The board half of the screen. Purely presentational: `PlayShell` owns the
 * connection so the room survives the trip back to the lobby.
 */
export function GameBoard({ game }: { game: ChessGameApi }) {
	const {
		state,
		me,
		opponent,
		myColor,
		position,
		isMyTurn,
		opponentOnline,
		notice,
		clocks,
	} = game;
	const boardStyles = useBoardStyles();

	// Captures are read back out of the position rather than tracked as they
	// happen, so this survives a reconnect or a refresh.
	const material = capturedFrom(position);
	const seat = (player: PlayerSnapshot | null) => ({
		name: player?.name ?? null,
		// Guests have no profile to link to, so the room sends `guest-…` and the
		// bar renders a plain name instead of a link.
		username: player?.username?.startsWith("guest-")
			? null
			: (player?.username ?? null),
		rating: player?.rating ?? null,
		country: player?.country || null,
		flair: player?.flair || null,
		image: player?.image || null,
		captured: player?.color === "w" ? material.byWhite : material.byBlack,
		advantage: player?.color === "w" ? material.advantage : -material.advantage,
	});

	// Only a game in progress has a clock counting down, and only on the side
	// that owes a move.
	const playing = state?.status === "playing";
	const myTurn = playing && state.turn === myColor;
	const theirTurn = playing && state.turn !== myColor;

	return (
		<BoardColumn
			bottom={
				<PlayerBar
					{...seat(me)}
					active={myTurn}
					clockMs={clocks[me?.sessionId ?? ""] ?? 0}
					online={me?.connected ?? false}
					running={myTurn}
				/>
			}
			notice={notice}
			top={
				<PlayerBar
					{...seat(opponent)}
					active={theirTurn}
					clockMs={clocks[opponent?.sessionId ?? ""] ?? 0}
					online={opponentOnline && (opponent?.connected ?? false)}
					running={theirTurn}
				/>
			}
		>
			{/* react-chessboard v5 takes a single `options` object. */}
			<Chessboard
				options={{
					...boardStyles,
					position,
					boardOrientation: myColor === "b" ? "black" : "white",
					allowDragging: isMyTurn,
					onPieceDrop: ({ sourceSquare, targetSquare }) =>
						targetSquare
							? game.makeMove(sourceSquare, targetSquare, "q")
							: false,
				}}
			/>
		</BoardColumn>
	);
}

/**
 * The same board with nobody on it, shown while you are picking a game or
 * waiting in the queue — so the lobby is a board plus a panel, not a form.
 * It doubles as the live preview for the board picker beside it.
 */
export function IdleBoard({
	seat,
	rating,
	clockMs,
}: {
	/** Who you are, so the bottom seat is yours before a game exists. */
	seat: {
		username: string;
		image: string | null;
		country: string | null;
		flair: string | null;
	};
	/**
	 * Your standing in the pool the chosen clock belongs to, or null while that
	 * pool is unrated — the starting number is not a fact about you, it is the
	 * one everybody begins with, and showing it would claim otherwise.
	 */
	rating: number | null;
	/** The chosen clock's starting time, shown on both seats. */
	clockMs: number;
}) {
	const t = useTranslations("game");
	const boardStyles = useBoardStyles();

	return (
		<BoardColumn
			bottom={
				<PlayerBar
					clockMs={clockMs}
					country={seat.country}
					flair={seat.flair}
					image={seat.image}
					name={seat.username}
					rating={rating}
					username={seat.username}
				/>
			}
			// No username, so the seat draws its empty-chair avatar rather than an
			// initial: there is nobody in it yet.
			top={<PlayerBar clockMs={clockMs} name={t("opponent")} />}
		>
			<Chessboard
				options={{
					...boardStyles,
					position: STARTING_FEN,
					allowDragging: false,
				}}
			/>
		</BoardColumn>
	);
}

/** Move sheet, offers and the in-game buttons. Sits in the right column. */
export function GamePanel({
	game,
	onNewGame,
}: {
	game: ChessGameApi;
	onNewGame: () => void;
}) {
	const t = useTranslations("game");
	const lobby = useTranslations("lobby");
	const { state, me, myColor, gameOver, drawOfferFrom } = game;
	if (!state) return null;

	return (
		<div className="flex flex-col gap-3">
			<div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
				<div className="flex items-baseline justify-between">
					<h2 className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
						{state.timeControl} ·{" "}
						{state.ranked ? lobby("rated") : lobby("casual")}
					</h2>
					{state.inCheck && state.status === "playing" && (
						<span className="font-semibold text-danger text-xs">
							{t("check")}
						</span>
					)}
				</div>

				<div className="-mx-4 mt-3 max-h-72 overflow-y-auto border-line border-t">
					<MoveList
						activePly={state.history.length}
						moves={state.history.map((san, index) => ({
							san,
							thinkMs: state.thinkMs[index] ?? null,
						}))}
					/>
				</div>
			</div>

			{drawOfferFrom && drawOfferFrom !== myColor && (
				<div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
					<p className="text-fg text-sm">{t("drawOffered")}</p>
					<div className="mt-3 flex gap-2">
						<Button onClick={game.acceptDraw} type="button">
							{t("accept")}
						</Button>
						<Button onClick={game.declineDraw} type="button" variant="outline">
							{t("decline")}
						</Button>
					</div>
				</div>
			)}

			{state.status === "playing" && (
				<div className="flex gap-2">
					{state.ply < 2 ? (
						<Button onClick={game.abort} type="button" variant="outline">
							{t("abort")}
						</Button>
					) : (
						<Button
							onClick={async () => {
								const confirmed = await confirmDestructive({
									title: t("resignConfirmTitle"),
									text: t("resignConfirmText"),
									confirmText: t("resign"),
								});
								if (confirmed) game.resign();
							}}
							type="button"
							variant="outline"
						>
							{t("resign")}
						</Button>
					)}
					<Button
						disabled={me?.offeringDraw}
						onClick={game.offerDraw}
						type="button"
						variant="outline"
					>
						{me?.offeringDraw ? t("drawSent") : t("offerDraw")}
					</Button>
				</div>
			)}

			{gameOver && (
				<div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
					<p className="font-semibold text-fg">
						{resultHeadline(gameOver, myColor, t)}
					</p>
					<p className="text-muted-foreground text-sm">
						{gameOver.result} — {t(`reasons.${gameOver.reason}`)}
					</p>
					{gameOver.ratings && (
						<p className="mt-1 text-muted-foreground text-sm tabular-nums">
							{gameOver.ratings
								.map((r) => `${r.delta >= 0 ? "+" : ""}${r.delta} → ${r.after}`)
								.join("  ·  ")}
						</p>
					)}
					<div className="mt-3 flex gap-2">
						<Button
							disabled={me?.wantsRematch}
							onClick={game.requestRematch}
							type="button"
						>
							{me?.wantsRematch ? t("rematchWaiting") : t("rematch")}
						</Button>
						<Button onClick={onNewGame} type="button" variant="outline">
							{t("newGame")}
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}

function resultHeadline(
	gameOver: NonNullable<ChessGameApi["gameOver"]>,
	myColor: string | null,
	t: (key: "aborted" | "draw" | "won" | "lost") => string,
): string {
	if (gameOver.result === "*") return t("aborted");
	if (!gameOver.winnerColor) return t("draw");
	return gameOver.winnerColor === myColor ? t("won") : t("lost");
}
