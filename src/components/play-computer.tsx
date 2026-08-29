"use client";

import { Chess } from "chess.js";
import {
	Bot as BotIcon,
	ChevronDown,
	Flag as FlagIcon,
	RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chessboard } from "react-chessboard";

import { BoardColumn, BoardLayout } from "@/components/board-layout";
import Flag from "@/components/flag";
import { PlayerBar } from "@/components/player-bar";
import { Button, buttonVariants } from "@/components/ui/button";
import { useBoardStyles } from "@/hooks/use-board-styles";
import { chooseMove } from "@/lib/bot";
import {
	BOT_GROUPS,
	type Bot,
	type BotGroupId,
	DEFAULT_BOT,
	strengthFor,
} from "@/lib/bots";
import { TIME_CONTROLS, type TimeControlId } from "@/lib/timeControls";
import { cn } from "@/lib/utils";

/** Which side the visitor sits on. `random` is settled when the game starts. */
type SideChoice = "w" | "b" | "random";

/** Everything the view needs, read off a live game in one pass. */
function read(game: Chess) {
	return {
		fen: game.fen(),
		history: game.history(),
		turn: game.turn(),
		over: game.isGameOver(),
		checkmate: game.isCheckmate(),
	};
}

/** The clocks the picker offers. A short list — this is not the rated lobby. */
const CLOCK_CHOICES: TimeControlId[] = ["3+0", "5+0", "10+0", "30+0"];

/**
 * Which of them a visitor starts on.
 *
 * Deliberately *not* the app's `DEFAULT_TIME_CONTROL`, which is `5+3` and is not
 * one of the four above. A `<select>` whose value matches no option displays the
 * first one instead, so the picker said "3 min" while the board counted down
 * five — the control and the clock disagreeing on screen. It has to come from
 * this list.
 *
 * Ten minutes because a visitor is learning the board and the opponent, not
 * defending a rating.
 */
const DEFAULT_CLOCK: TimeControlId = "10+0";

/**
 * The front page for somebody who has not signed in.
 *
 * The lobby needs an account — a rating to be matched on and a seat to be put
 * in — so a visitor used to be redirected straight to a sign-in screen. That
 * made the one page every search result lands on a door rather than a room.
 *
 * Laid out the way chess.com lays out its bots: the board is there from the
 * first frame, and the right column is a roster of named opponents with faces
 * and ratings rather than three difficulty buttons. "Medium" tells nobody
 * anything; "Ilinca, 750" tells a chess player exactly what they are choosing.
 *
 * Nothing here is saved and nothing is rated. The invitation to sign up sits at
 * the bottom of the panel rather than in the way, because somebody who has just
 * enjoyed a game is a better person to ask than somebody who has not had one.
 */
export default function PlayComputer() {
	const t = useTranslations("computer");
	const boardStyles = useBoardStyles();

	const [bot, setBot] = useState<Bot>(DEFAULT_BOT);
	const [openGroup, setOpenGroup] = useState<string>(
		BOT_GROUPS[0]?.id ?? "newToChess",
	);
	const [clockId, setClockId] = useState<TimeControlId>(DEFAULT_CLOCK);
	const [sideChoice, setSideChoice] = useState<SideChoice>("w");

	/** Null while picking; set to the settled side once a game is running. */
	const [side, setSide] = useState<"w" | "b" | null>(null);
	const playing = side !== null;

	/*
	 * The game lives in a ref and the position in state.
	 *
	 * `Chess` is mutated in place, so keeping the instance in state would hand
	 * React the same object reference after every move and nothing would
	 * re-render. The ref is the game; the snapshot is what React draws — and it
	 * is a snapshot rather than a FEN because a FEN is a position, not a game:
	 * `new Chess(fen).history()` is always empty, and a board rebuilt from one
	 * cannot see a threefold repetition either.
	 */
	const game = useRef(new Chess());
	const [snapshot, setSnapshot] = useState(() => read(game.current));
	const [thinking, setThinking] = useState(false);
	const [round, setRound] = useState(0);

	const control = TIME_CONTROLS[clockId];
	const [clocks, setClocks] = useState({
		w: control.initialMs,
		b: control.initialMs,
	});
	/** Set when a clock runs out — the one ending a game the board cannot see. */
	const [flagged, setFlagged] = useState<"w" | "b" | null>(null);

	const myTurn = playing && snapshot.turn === side;

	const outcome = !playing
		? null
		: flagged
			? flagged === side
				? "loss"
				: "win"
			: snapshot.over
				? snapshot.checkmate
					? // The side to move is the one that has been mated.
						snapshot.turn === side
						? "loss"
						: "win"
					: "draw"
				: null;

	/** The score sheet, paired by full move — a row's identity is its number. */
	const rows = useMemo(
		() =>
			Array.from(
				{ length: Math.ceil(snapshot.history.length / 2) },
				(_, pair) => ({
					number: pair + 1,
					white: snapshot.history[pair * 2] ?? "",
					black: snapshot.history[pair * 2 + 1] ?? "",
				}),
			),
		[snapshot.history],
	);

	const sync = useCallback(() => setSnapshot(read(game.current)), []);

	/** Adds the mover's increment, if the chosen clock has one. */
	const addIncrement = useCallback(
		(mover: "w" | "b") => {
			if (control.incrementMs === 0) return;
			setClocks((c) => ({ ...c, [mover]: c[mover] + control.incrementMs }));
		},
		[control.incrementMs],
	);

	/** Applies a move if it is legal, and says whether it was. */
	const play = useCallback(
		(from: string, to: string) => {
			const mover = game.current.turn();
			try {
				// Always a queen: under-promotion needs a picker, and this board is a
				// first impression rather than a tournament.
				game.current.move({ from, to, promotion: "q" });
			} catch {
				// chess.js throws on an illegal move; the board snaps the piece back.
				return false;
			}
			addIncrement(mover);
			sync();
			return true;
		},
		[sync, addIncrement],
	);

	/*
	 * The clock.
	 *
	 * Ticks against whoever is to move, including the bot while it thinks — which
	 * is the honest thing, since that time really is being spent. Stops on the
	 * first side to reach zero and records who it was; a flag is the one way this
	 * game can end that the board itself knows nothing about.
	 */
	useEffect(() => {
		if (!playing || outcome) return;

		const turn = snapshot.turn;
		const timer = setInterval(() => {
			setClocks((current) => {
				const left = Math.max(0, current[turn] - 100);
				if (left === 0) setFlagged(turn);
				return { ...current, [turn]: left };
			});
		}, 100);

		return () => clearInterval(timer);
	}, [playing, outcome, snapshot.turn]);

	/*
	 * The opponent's turn.
	 *
	 * The search blocks for up to the bot's budget, so it is pushed behind a
	 * timeout: React paints the visitor's own move and the thinking line first,
	 * and the board never appears to swallow a move while it computes.
	 */
	// biome-ignore lint/correctness/useExhaustiveDependencies: `round` is load-bearing, not surplus. Starting a new game on the same side against the same bot leaves every other value in this list identical, so nothing would change and the opponent would never make its opening move.
	useEffect(() => {
		if (!playing || myTurn || outcome) return;

		setThinking(true);
		let cancelled = false;

		const timer = setTimeout(() => {
			const san = chooseMove(game.current.fen(), strengthFor(bot.rating));
			if (cancelled) return;

			if (san) {
				const mover = game.current.turn();
				game.current.move(san);
				addIncrement(mover);
				sync();
			}
			setThinking(false);
		}, 250);

		return () => {
			cancelled = true;
			clearTimeout(timer);
			setThinking(false);
		};
	}, [playing, myTurn, outcome, bot.rating, round, sync, addIncrement]);

	const start = useCallback(() => {
		const settled =
			sideChoice === "random" ? (Math.random() < 0.5 ? "w" : "b") : sideChoice;

		game.current = new Chess();
		setSide(settled);
		setFlagged(null);
		setClocks({ w: control.initialMs, b: control.initialMs });
		sync();
		setRound((n) => n + 1);
	}, [sideChoice, control.initialMs, sync]);

	const backToPicker = useCallback(() => {
		game.current = new Chess();
		setSide(null);
		setFlagged(null);
		setClocks({ w: control.initialMs, b: control.initialMs });
		sync();
	}, [control.initialMs, sync]);

	const status = outcome
		? t(`outcome.${outcome}`)
		: thinking
			? t("thinking")
			: t("yourMove");

	return (
		<BoardLayout
			board={
				<BoardColumn
					bottom={
						<PlayerBar
							active={myTurn && !outcome}
							clockMs={playing ? clocks[side] : control.initialMs}
							name={t("you")}
							running={myTurn && !outcome}
						/>
					}
					top={
						<PlayerBar
							active={playing && !myTurn && !outcome}
							clockMs={
								playing ? clocks[side === "w" ? "b" : "w"] : control.initialMs
							}
							country={bot.country}
							name={bot.name}
							rating={bot.rating}
							running={playing && !myTurn && !outcome}
						/>
					}
				>
					<Chessboard
						options={{
							...boardStyles,
							position: snapshot.fen,
							boardOrientation: side === "b" ? "black" : "white",
							// Locked before the game starts and while the opponent thinks, so
							// a move cannot land in a position that is about to change.
							allowDragging: myTurn && !outcome && !thinking,
							onPieceDrop: ({ sourceSquare, targetSquare }) =>
								targetSquare ? play(sourceSquare, targetSquare) : false,
						}}
					/>
				</BoardColumn>
			}
			panel={
				<div className="flex h-full flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm">
					<h1 className="flex items-center justify-center gap-2 font-bold text-fg text-lg">
						<BotIcon aria-hidden className="h-5 w-5 text-primary" />
						{t("title")}
					</h1>

					{/* Who you are about to play, and what they have to say about it. */}
					<div className="flex items-start gap-3">
						<BotFace bot={bot} className="size-14 shrink-0 text-xl" />
						<div className="min-w-0 flex-1">
							<p
								aria-live="polite"
								className="rounded-xl rounded-bl-none bg-elevated px-3 py-2 text-fg text-sm"
							>
								{playing ? status : t("greeting", { name: bot.name })}
							</p>
							<p className="mt-1.5 flex items-center gap-1.5 font-bold text-fg">
								{bot.name}
								<span className="font-semibold text-muted-foreground text-sm tabular-nums">
									{bot.rating}
								</span>
								<Flag className="rounded-xs" code={bot.country} />
							</p>
						</div>
					</div>

					{playing ? (
						<PlayingPanel
							onNewGame={backToPicker}
							onResign={() => side && setFlagged(side)}
							outcome={outcome}
							rows={rows}
						/>
					) : (
						<Picker
							bot={bot}
							clockId={clockId}
							onClock={setClockId}
							onPick={setBot}
							onSide={setSideChoice}
							onStart={start}
							onToggleGroup={(id) =>
								setOpenGroup((current) => (current === id ? "" : id))
							}
							openGroup={openGroup}
							sideChoice={sideChoice}
						/>
					)}

					{/*
					 * The ask, phrased as what they would gain rather than as a wall they
					 * have already run into. Outline, not filled: on this page the filled
					 * button is Play, and two of them would compete.
					 */}
					<Link
						className={cn(buttonVariants({ variant: "outline" }), "w-full")}
						href="/login"
					>
						{t("signUpCta")}
					</Link>
				</div>
			}
		/>
	);
}

/** The roster, the clock, the side, and the button that starts it. */
function Picker({
	bot,
	clockId,
	onClock,
	onPick,
	onSide,
	onStart,
	onToggleGroup,
	openGroup,
	sideChoice,
}: {
	bot: Bot;
	clockId: TimeControlId;
	onClock: (id: TimeControlId) => void;
	onPick: (bot: Bot) => void;
	onSide: (side: SideChoice) => void;
	onStart: () => void;
	onToggleGroup: (id: BotGroupId) => void;
	openGroup: string;
	sideChoice: SideChoice;
}) {
	const t = useTranslations("computer");

	return (
		<>
			{/* The one scrolling part, so the clock and Play stay put. */}
			<div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
				<div className="flex flex-col gap-1.5">
					{BOT_GROUPS.map((group) => {
						const open = group.id === openGroup;

						return (
							<div
								className="overflow-hidden rounded-lg bg-elevated"
								key={group.id}
							>
								<button
									className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition hover:bg-line/40"
									onClick={() => onToggleGroup(group.id)}
									type="button"
								>
									<span className="flex-1 font-semibold text-fg text-sm">
										{t(`groups.${group.id}`)}
									</span>
									<span className="text-muted-foreground text-xs tabular-nums">
										{t("botCount", { count: group.bots.length })}
									</span>
									<ChevronDown
										aria-hidden
										className={cn(
											"h-4 w-4 text-muted-foreground transition-transform",
											open && "rotate-180",
										)}
									/>
								</button>

								{open && (
									<div className="grid grid-cols-5 gap-2 px-3 pb-3">
										{group.bots.map((option) => (
											<button
												className="flex min-w-0 flex-col items-center gap-1"
												key={option.id}
												onClick={() => onPick(option)}
												type="button"
											>
												<BotFace
													bot={option}
													className={cn(
														"size-11 text-base ring-2 transition",
														option.id === bot.id
															? "ring-primary"
															: "ring-transparent hover:ring-line",
													)}
												/>
												<span className="w-full truncate text-center font-semibold text-[11px] text-fg">
													{option.name}
												</span>
												<span className="text-[10px] text-muted-foreground tabular-nums">
													{option.rating}
												</span>
											</button>
										))}
									</div>
								)}
							</div>
						);
					})}
				</div>
			</div>

			<div className="flex items-center gap-2">
				{/* A native select: four fixed options is exactly what it is for, and it
				    is the one control that already works properly on a phone. */}
				<select
					aria-label={t("timeControl")}
					className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-elevated px-2 font-semibold text-fg text-sm"
					onChange={(event) => onClock(event.target.value as TimeControlId)}
					value={clockId}
				>
					{CLOCK_CHOICES.map((id) => (
						<option key={id} value={id}>
							{TIME_CONTROLS[id].label}
						</option>
					))}
				</select>

				{/* Which colour you want. Three states, so three buttons rather than a
				    toggle — random is a choice, not the absence of one. */}
				<div className="flex shrink-0 gap-1">
					{(["w", "random", "b"] as const).map((option) => (
						<button
							aria-label={t(`side.${option}`)}
							aria-pressed={sideChoice === option}
							className={cn(
								"flex h-9 w-9 items-center justify-center rounded-lg border transition",
								sideChoice === option
									? "border-primary bg-primary/10"
									: "border-line bg-elevated hover:bg-line/40",
							)}
							key={option}
							onClick={() => onSide(option)}
							type="button"
						>
							<SideDot side={option} />
						</button>
					))}
				</div>
			</div>

			<Button className="w-full" onClick={onStart} size="lg">
				{t("play")}
			</Button>
		</>
	);
}

/**
 * A bot's face: its initial on its own colour.
 *
 * Drawn here rather than through `MemberAvatar`, which takes an image or falls
 * back to a themed tile and has no way to be given a colour. These are not
 * members and have no pictures — the colour *is* the identity, and it has to be
 * a literal for the same reason the brand mark's is: a face that changed with
 * the wallpaper would stop being that bot's face.
 */
function BotFace({ bot, className }: { bot: Bot; className?: string }) {
	return (
		<span
			aria-hidden
			className={cn(
				"flex items-center justify-center rounded-xl font-bold text-white",
				className,
			)}
			style={{ backgroundColor: bot.accent }}
		>
			{bot.name.charAt(0)}
		</span>
	);
}

/** A disc in the colour it stands for; split down the middle for random. */
function SideDot({ side }: { side: SideChoice }) {
	return (
		<span
			aria-hidden
			className="h-5 w-5 rounded-full border border-line"
			style={
				side === "random"
					? {
							background:
								"linear-gradient(135deg, #f2f2f2 0 50%, #2e2e38 50% 100%)",
						}
					: { backgroundColor: side === "w" ? "#f2f2f2" : "#2e2e38" }
			}
		/>
	);
}

/** The panel once a game is running: the score sheet and the two ways out. */
function PlayingPanel({
	onNewGame,
	onResign,
	outcome,
	rows,
}: {
	onNewGame: () => void;
	onResign: () => void;
	outcome: string | null;
	rows: { number: number; white: string; black: string }[];
}) {
	const t = useTranslations("computer");

	return (
		<>
			<div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
				{rows.length === 0 ? (
					<p className="py-6 text-center text-muted-foreground text-sm">
						{t("noMovesYet")}
					</p>
				) : (
					<ol className="rounded-lg bg-elevated p-2 text-sm tabular-nums">
						{rows.map((row) => (
							<li className="flex gap-3 px-1 py-0.5" key={row.number}>
								<span className="w-6 shrink-0 text-subtle">{row.number}.</span>
								<span className="w-16 text-fg">{row.white}</span>
								<span className="w-16 text-fg">{row.black}</span>
							</li>
						))}
					</ol>
				)}
			</div>

			<div className="flex gap-2">
				{!outcome && (
					<Button className="flex-1" onClick={onResign} variant="outline">
						<FlagIcon aria-hidden />
						{t("resign")}
					</Button>
				)}
				<Button className="flex-1" onClick={onNewGame} variant="outline">
					<RotateCcw aria-hidden />
					{t("newGame")}
				</Button>
			</div>
		</>
	);
}
