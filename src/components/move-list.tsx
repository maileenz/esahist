"use client";

import { PieceIcon } from "@/components/chess-pieces";
import { useBoard } from "@/components/theme/theme-provider";

export interface ListedMove {
	san: string;
	/** Milliseconds spent on the move, when it was recorded. */
	thinkMs?: number | null;
}

/** SAN starts with the piece letter for everything except pawns and castling. */
function pieceOf(san: string): string | null {
	const first = san[0];
	return first && "KQRBN".includes(first) ? first.toLowerCase() : null;
}

/** `Nxd4` → `xd4`, `d4` → `d4`. The figurine carries the piece instead. */
function withoutPiece(san: string): string {
	return pieceOf(san) ? san.slice(1) : san;
}

function formatThink(ms: number): string {
	if (ms >= 60_000) return `${Math.floor(ms / 60_000)}m`;
	if (ms >= 10_000) return `${Math.round(ms / 1000)}s`;
	return `${(ms / 1000).toFixed(1)}s`;
}

/** Widest a bar may grow, in pixels. Also the column the numbers align against. */
const BAR_MAX = 22;

/**
 * The move sheet, shared by the live game and the replay.
 *
 * One row per full move: number, both sides' figurine notation, then a narrow
 * column ruled off on the right holding the time each side spent — White's line
 * above Black's, the way a scoresheet reads.
 *
 * The two times sit inside the move's own row rather than on a line of their
 * own, so a row stays one glance wide and the sheet keeps its rhythm.
 */
export default function MoveList({
	moves,
	activePly = null,
	onSelect,
	emptyLabel = "No moves yet.",
}: {
	moves: ListedMove[];
	/** 1-based ply to highlight; null for none. */
	activePly?: number | null;
	/** Omit to render a read-only sheet. */
	onSelect?: (ply: number) => void;
	emptyLabel?: string;
}) {
	if (moves.length === 0) {
		return <p className="p-3 text-sm text-subtle">{emptyLabel}</p>;
	}

	const timed = moves.some(
		(move) => move.thinkMs !== null && move.thinkMs !== undefined,
	);

	// Bars are scaled against the longest think time in this game, so a bullet
	// game and a long rapid one both read — a fixed ceiling would flatten one and
	// saturate the other.
	const longest = Math.max(1, ...moves.map((move) => move.thinkMs ?? 0));

	const rows = [];
	for (let index = 0; index < moves.length; index += 2) {
		rows.push({
			number: index / 2 + 1,
			ply: index + 1,
			white: moves[index],
			black: moves[index + 1],
		});
	}

	return (
		<ol className="text-sm">
			{rows.map((row) => (
				<li
					className={`grid items-stretch border-line border-b last:border-b-0 odd:bg-elevated/40 ${
						timed
							? "grid-cols-[2.25rem_1fr_1fr_5.25rem]"
							: "grid-cols-[2.25rem_1fr_1fr]"
					}`}
					key={row.number}
				>
					<span className="flex items-center px-2 text-subtle text-xs tabular-nums">
						{row.number}.
					</span>

					<MoveCell
						colour="w"
						move={row.white}
						onSelect={onSelect}
						ply={row.ply}
						selected={activePly === row.ply}
					/>
					<MoveCell
						colour="b"
						move={row.black}
						onSelect={onSelect}
						ply={row.ply + 1}
						selected={activePly === row.ply + 1}
					/>

					{timed && (
						<span className="flex flex-col justify-center border-line border-l py-1 pr-2 pl-1.5">
							<Think colour="w" longest={longest} ms={row.white?.thinkMs} />
							<Think colour="b" longest={longest} ms={row.black?.thinkMs} />
						</span>
					)}
				</li>
			))}
		</ol>
	);
}

function MoveCell({
	move,
	colour,
	ply,
	selected,
	onSelect,
}: {
	move?: ListedMove;
	colour: "w" | "b";
	ply: number;
	selected: boolean;
	onSelect?: (ply: number) => void;
}) {
	// Above the early return: a row where only White has moved renders this
	// component with no move, and a hook that runs on some renders and not
	// others is the one thing React will not forgive.
	const { pieceSet } = useBoard();

	if (!move) return <span />;

	// The sheet's figurines are the same set as the board's, so a game does not
	// show two different knights. Through `PieceIcon` rather than an <img>,
	// because only one of the three kinds of set is made of images — the other
	// two were asking for a PNG that has never existed.
	const piece = pieceOf(move.san);
	const body = (
		<>
			{piece && (
				<PieceIcon
					className="h-[18px] w-[18px] shrink-0"
					code={`${colour}${piece}`}
					set={pieceSet}
				/>
			)}
			<span className="truncate">{withoutPiece(move.san)}</span>
		</>
	);

	const className = `flex items-center gap-0.5 px-1.5 py-1.5 font-semibold ${
		selected ? "bg-warning-soft text-warning" : "text-fg"
	}`;

	if (!onSelect) return <span className={className}>{body}</span>;

	return (
		<button
			className={`${className} text-left transition hover:bg-elevated`}
			onClick={() => onSelect(ply)}
			type="button"
		>
			{body}
		</button>
	);
}

/**
 * One line of the time column: a bar, then the number.
 *
 * The bar is the colour of the piece that moved — light for White, dark for
 * Black — so a glance down the column tells you whose time you are reading
 * without counting lines. Both carry a contrasting ring, because a white bar
 * needs an edge on a light theme and a black one needs an edge on a dark theme.
 *
 * The number sits in a fixed box on the right so every row's digits line up and
 * the bars grow leftward from them — the column reads as a small chart rather
 * than ragged text. An empty line still takes its height, so a row with only
 * White's move keeps the same shape as its neighbours.
 */
function Think({
	ms,
	longest,
	colour,
}: {
	ms?: number | null;
	longest: number;
	colour: "w" | "b";
}) {
	if (ms === null || ms === undefined) {
		return <span className="h-[14px]" />;
	}

	const width = Math.max(2, Math.round((ms / longest) * BAR_MAX));
	const side = colour === "w" ? "White" : "Black";

	return (
		<span
			className="flex h-[14px] items-center justify-end gap-1 text-[10px] text-subtle tabular-nums leading-none"
			title={`${side} spent ${formatThink(ms)}`}
		>
			<span
				aria-hidden
				className={`h-[7px] rounded-[1px] ring-1 ${
					colour === "w"
						? "bg-white ring-black/30"
						: "bg-neutral-900 ring-white/25"
				}`}
				style={{ width: `${width}px` }}
			/>
			<span className="w-[2.1rem] text-right">{formatThink(ms)}</span>
		</span>
	);
}
