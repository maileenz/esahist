"use client";

import { Chess } from "chess.js";
import {
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
	FlipVertical2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Chessboard } from "react-chessboard";

import { BoardColumn, BoardLayout } from "@/components/board-layout";
import MoveList from "@/components/move-list";
import { PlayerBar } from "@/components/player-bar";
import { Button } from "@/components/ui/button";
import { STARTING_FEN, useBoardStyles } from "@/hooks/use-board-styles";
import { capturedFrom } from "@/lib/captured";
import type { RouterOutputs } from "@/trpc/react";

type Game = NonNullable<RouterOutputs["member"]["game"]>;

interface Step {
	san: string;
	fen: string;
	clockMs: number | null;
	thinkMs: number | null;
}

/**
 * Positions come from `game_history.fen_after`, so stepping is an index into a
 * list rather than a replay. Games stored before that table was populated only
 * have the SAN string, so those are reconstructed with chess.js instead.
 */
function buildSteps(game: Game): Step[] {
	if (game.history.length > 0) {
		return game.history.map((row) => ({
			san: row.san,
			fen: row.fenAfter,
			clockMs: row.clockMs,
			thinkMs: row.thinkMs,
		}));
	}

	const chess = new Chess();
	const steps: Step[] = [];
	for (const san of (game.moves ?? "").split(" ").filter(Boolean)) {
		try {
			chess.move(san);
		} catch {
			break; // a malformed move sheet stops the replay where it breaks
		}
		steps.push({ san, fen: chess.fen(), clockMs: null, thinkMs: null });
	}
	return steps;
}

export default function GameReplay({ game }: { game: Game }) {
	const lobby = useTranslations("lobby");
	const gameT = useTranslations("game");
	const t = useTranslations("profile");
	const steps = useMemo(() => buildSteps(game), [game]);
	const [ply, setPly] = useState(steps.length);
	const [flipped, setFlipped] = useState(false);
	const boardStyles = useBoardStyles();

	useEffect(() => {
		function onKey(event: KeyboardEvent) {
			if (event.key === "ArrowLeft") setPly((value) => Math.max(0, value - 1));
			if (event.key === "ArrowRight")
				setPly((value) => Math.min(steps.length, value + 1));
			if (event.key === "Home") setPly(0);
			if (event.key === "End") setPly(steps.length);
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [steps.length]);

	const position =
		ply === 0 ? STARTING_FEN : (steps[ply - 1]?.fen ?? STARTING_FEN);

	// Read off the position rather than tracked, so it is correct at any ply
	// you jump to — the same way the live board does it.
	const material = useMemo(() => capturedFrom(position), [position]);
	const headline =
		game.result === "1-0"
			? t("whiteWon")
			: game.result === "0-1"
				? t("blackWon")
				: game.result === "1/2-1/2"
					? gameT("draw")
					: gameT("aborted");

	return (
		<BoardLayout
			board={
				<BoardColumn
					bottom={
						<PlayerBar
							active={toMove(ply) === (flipped ? "b" : "w")}
							advantage={flipped ? -material.advantage : material.advantage}
							captured={flipped ? material.byBlack : material.byWhite}
							clockMs={clockFor(steps, ply, flipped ? "b" : "w")}
							country={flipped ? game.blackCountry : game.whiteCountry}
							delta={flipped ? game.blackDelta : game.whiteDelta}
							flair={flipped ? game.blackFlair : game.whiteFlair}
							image={flipped ? game.blackImage : game.whiteImage}
							name={flipped ? game.blackUsername : game.whiteUsername}
							rating={flipped ? game.blackRating : game.whiteRating}
							username={flipped ? game.blackUsername : game.whiteUsername}
						/>
					}
					top={
						<PlayerBar
							active={toMove(ply) === (flipped ? "w" : "b")}
							advantage={flipped ? material.advantage : -material.advantage}
							captured={flipped ? material.byWhite : material.byBlack}
							clockMs={clockFor(steps, ply, flipped ? "w" : "b")}
							country={flipped ? game.whiteCountry : game.blackCountry}
							delta={flipped ? game.whiteDelta : game.blackDelta}
							flair={flipped ? game.whiteFlair : game.blackFlair}
							image={flipped ? game.whiteImage : game.blackImage}
							name={flipped ? game.whiteUsername : game.blackUsername}
							rating={flipped ? game.whiteRating : game.blackRating}
							username={flipped ? game.whiteUsername : game.blackUsername}
						/>
					}
				>
					<Chessboard
						options={{
							...boardStyles,
							position,
							boardOrientation: flipped ? "black" : "white",
							allowDragging: false,
						}}
					/>
				</BoardColumn>
			}
			panel={
				// A column that fills the panel: the move sheet takes the slack and
				// scrolls inside itself, so the controls stay put at the bottom
				// instead of being pushed off the end of a ninety-move game.
				<div className="flex flex-col gap-3 lg:h-full">
					<div className="flex items-start gap-2 rounded-xl border border-line bg-surface p-4 shadow-sm">
						<div className="min-w-0 flex-1">
							<p className="font-semibold text-fg">{headline}</p>
							<p className="text-muted-foreground text-sm">
								{game.result ?? "*"}
								{game.reason ? ` — ${game.reason.replace(/_/g, " ")}` : ""}
							</p>
							<p className="mt-1 text-subtle text-xs">
								{game.timeControl} ·{" "}
								{game.ranked ? lobby("rated") : lobby("casual")} ·{" "}
								{new Date(game.startedAt).toLocaleString()}
							</p>
						</div>
					</div>

					<div className="rounded-xl border border-line bg-surface p-4 shadow-sm lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
						<h2 className="shrink-0 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
							{gameT("moves")}
						</h2>
						<div className="-mx-4 mt-2 max-h-96 overflow-y-auto border-line border-t lg:max-h-none lg:min-h-0 lg:flex-1">
							<MoveList
								activePly={ply}
								emptyLabel={t("noMoves")}
								moves={steps.map((step) => ({
									san: step.san,
									thinkMs: step.thinkMs,
								}))}
								onSelect={setPly}
							/>
						</div>
					</div>

					<div className="flex shrink-0 items-center justify-center gap-2">
						<Control
							disabled={ply === 0}
							label={gameT("firstMove")}
							onClick={() => setPly(0)}
						>
							<ChevronsLeft aria-hidden />
						</Control>
						<Control
							disabled={ply === 0}
							label={gameT("previousMove")}
							onClick={() => setPly((value) => Math.max(0, value - 1))}
						>
							<ChevronLeft aria-hidden />
						</Control>
						<span className="min-w-24 text-center text-muted-foreground text-sm tabular-nums">
							{ply} / {steps.length}
						</span>
						<Control
							disabled={ply === steps.length}
							label={gameT("nextMove")}
							onClick={() =>
								setPly((value) => Math.min(steps.length, value + 1))
							}
						>
							<ChevronRight aria-hidden />
						</Control>
						<Control
							disabled={ply === steps.length}
							label={gameT("lastMove")}
							onClick={() => setPly(steps.length)}
						>
							<ChevronsRight aria-hidden />
						</Control>
						<Button
							className="ml-2"
							onClick={() => setFlipped((value) => !value)}
							title={gameT("flipBoard")}
							type="button"
							variant="outline"
						>
							<FlipVertical2 aria-hidden />
							{gameT("flip")}
						</Button>
					</div>

					<p className="shrink-0 text-center text-subtle text-xs">
						← → to step · Home / End to jump
					</p>
				</div>
			}
		/>
	);
}

/** Whose turn it is at this point in the replay — white moves on even plies. */
function toMove(ply: number): "w" | "b" {
	return ply % 2 === 0 ? "w" : "b";
}

/** The mover's remaining time at this ply, when the history recorded it. */
function clockFor(steps: Step[], ply: number, color: "w" | "b"): number | null {
	for (let index = ply - 1; index >= 0; index--) {
		const isWhiteMove = index % 2 === 0;
		if ((color === "w") === isWhiteMove) return steps[index]?.clockMs ?? null;
	}
	return null;
}

function Control({
	label,
	onClick,
	disabled,
	children,
}: {
	/** Names the button for screen readers; the glyph itself is decorative. */
	label: string;
	onClick: () => void;
	disabled: boolean;
	children: React.ReactNode;
}) {
	return (
		<Button
			aria-label={label}
			disabled={disabled}
			onClick={onClick}
			size="icon"
			title={label}
			type="button"
			variant="outline"
		>
			{children}
		</Button>
	);
}
