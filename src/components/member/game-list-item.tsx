"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import Flag from "@/components/flag";
import Flair from "@/components/flair";
import MemberAvatar from "@/components/member-avatar";
import { CATEGORY_META, resolveTimeControl } from "@/lib/timeControls";

interface GamePlayer {
	username: string;
	/** What they were rated going in. */
	rating: number | null;
	/** What the game did to it — null for an unrated or unfinished game. */
	delta: number | null;
	image: string | null;
	country: string | null;
	flair: string | null;
}

export interface GameListRow {
	id: string;
	/** The side this list is written from — null for a game you only watched. */
	perspective: "w" | "b" | null;
	/** Read from `perspective`; null when there is no side to read it from. */
	outcome: "win" | "loss" | "draw" | "aborted" | null;
	/**
	 * Whether the *viewer* played in it — which is not the same as `perspective`,
	 * that being the profile owner's side. On somebody else's profile every row
	 * has a perspective and almost none of them are yours.
	 */
	mine: boolean;
	white: GamePlayer;
	black: GamePlayer;
	result: string | null;
	reason: string | null;
	timeControl: string;
	ranked: boolean;
	moves: number;
	playedAt: Date | string;
}

/** "1-0" → 1 for White, 0 for Black. */
function scoreFor(result: string | null, color: "w" | "b"): string {
	if (result === "1/2-1/2") return "½";
	if (result === "1-0") return color === "w" ? "1" : "0";
	if (result === "0-1") return color === "w" ? "0" : "1";
	return "–";
}

/**
 * One row of a game archive: clock, both players, the score, length and date.
 */
export default function GameListItem({ game }: { game: GameListRow }) {
	const lobby = useTranslations("lobby");
	const control = resolveTimeControl(game.timeControl);
	const category = CATEGORY_META[control.category];

	return (
		<li className="border-line border-b last:border-b-0">
			<div className="flex items-center gap-2 pr-3 transition hover:bg-elevated sm:gap-4">
				<Link
					className="flex min-w-0 flex-1 items-center gap-2 py-2.5 pl-3 sm:gap-4"
					href={`/game/${game.id}`}
				>
					<span
						className="flex w-12 shrink-0 flex-col items-center gap-y-1 text-center"
						title={`${category.label} · ${game.ranked ? lobby("rated") : lobby("casual")}`}
					>
						<span aria-hidden className="text-lg leading-none">
							{category.icon}
						</span>
						<span className="mt-0.5 text-[11px] text-muted-foreground leading-tight">
							{control.label}
						</span>
					</span>

					<span className="flex min-w-0 flex-1 flex-col gap-0.5">
						<PlayerLine
							colour="w"
							highlight={game.perspective === "w"}
							player={game.white}
							ranked={game.ranked}
						/>
						<PlayerLine
							colour="b"
							highlight={game.perspective === "b"}
							player={game.black}
							ranked={game.ranked}
						/>
					</span>

					<span className="flex w-12 shrink-0 items-center justify-center gap-1.5">
						<span className="flex w-4 flex-col items-center font-medium text-sm tabular-nums">
							<Score colour="w" result={game.result} />
							<Score colour="b" result={game.result} />
						</span>
						<OutcomeBadge outcome={game.outcome} />
					</span>

					<span
						className="hidden w-12 shrink-0 text-center text-muted-foreground text-sm tabular-nums sm:block"
						title={game.reason ? game.reason.replace(/_/g, " ") : undefined}
					>
						{game.moves}
					</span>

					<time
						className="hidden w-24 shrink-0 text-right text-muted-foreground text-sm sm:block"
						dateTime={new Date(game.playedAt).toISOString()}
					>
						{new Date(game.playedAt).toLocaleDateString(undefined, {
							day: "numeric",
							month: "short",
							year: "numeric",
						})}
					</time>
				</Link>
			</div>
		</li>
	);
}

/**
 * Won, drew or lost — from the side this list is written from.
 *
 * The scores beside it say what happened to the board; this says what happened
 * to *you*, which is the thing somebody scanning their own history is actually
 * looking for. A game with no side to read it from — one you only watched — and
 * an aborted one both get nothing, because neither has an answer.
 */
function OutcomeBadge({ outcome }: { outcome: GameListRow["outcome"] }) {
	const t = useTranslations("game");
	if (!outcome || outcome === "aborted") {
		// Keeps the column the same width, so the rows below still line up.
		return <span aria-hidden className="w-4 shrink-0" />;
	}

	const { glyph, label, tone } = {
		win: {
			glyph: "+",
			label: t("wonShort"),
			tone: "bg-primary text-primary-foreground",
		},
		draw: { glyph: "=", label: t("drew"), tone: "bg-subtle text-canvas" },
		loss: { glyph: "−", label: t("lostShort"), tone: "bg-danger text-white" },
	}[outcome];

	return (
		<span
			className={`flex size-4 shrink-0 items-center justify-center rounded-xs font-bold text-[11px] leading-none ${tone}`}
			title={label}
		>
			<span className="sr-only">{label}</span>
			<span aria-hidden>{glyph}</span>
		</span>
	);
}

/**
 * Column headings, matching the row's grid.
 *
 * Every width here has a twin in `GameListItem`, and the two only line up
 * because they agree: `w-12` for the clock, `w-12` for the result, `w-12` for
 * moves and `w-24` for the date. Change one, change both.
 */
export function GameListHeader() {
	const t = useTranslations("game");

	return (
		<div className="flex items-center gap-2 border-line border-b bg-elevated px-3 py-1.5 font-semibold text-[11px] text-muted-foreground uppercase tracking-wide sm:gap-4">
			<span className="w-12 shrink-0" />
			<span className="min-w-0 flex-1">{t("players")}</span>
			<span className="w-12 shrink-0 text-center">{t("result")}</span>
			<span className="hidden w-12 shrink-0 text-center sm:block">
				{t("moves")}
			</span>
			<span className="hidden w-24 shrink-0 text-right sm:block">
				{t("date")}
			</span>
		</div>
	);
}

function Score({
	result,
	colour,
}: {
	result: string | null;
	colour: "w" | "b";
}) {
	const score = scoreFor(result, colour);
	const tone =
		score === "1"
			? "text-fg"
			: score === "½"
				? "text-muted-foreground"
				: score === "0"
					? "text-subtle"
					: "text-subtle";

	return <span className={`leading-tight ${tone}`}>{score}</span>;
}

function PlayerLine({
	player,
	colour,
	highlight,
	ranked,
}: {
	player: GamePlayer;
	colour: "w" | "b";
	highlight: boolean;
	ranked: boolean;
}) {
	const t = useTranslations("game");
	return (
		<span className="flex min-w-0 items-center gap-1.5">
			<MemberAvatar
				className="size-4 rounded-xs"
				image={player.image}
				name={player.username}
			/>

			<span
				aria-hidden
				className={`h-2.5 w-2.5 shrink-0 rounded-xs border ${
					colour === "w"
						? "border-line bg-white"
						: "border-neutral-700 bg-black"
				}`}
				title={colour === "w" ? t("white") : t("black")}
			/>

			<span
				className={`truncate text-sm ${
					highlight ? "font-semibold text-fg" : "text-fg"
				}`}
			>
				{player.username}
			</span>

			{player.rating !== null && (
				<span className="shrink-0 text-subtle text-xs tabular-nums">
					({player.rating})
				</span>
			)}

			<Flag className="shrink-0 rounded-xs text-xs" code={player.country} />
			<Flair className="text-xs" id={player.flair} />

			<RatingDelta delta={player.delta} ranked={ranked} />
		</span>
	);
}

/**
 * What the game cost or paid, for one side.
 *
 * Only when it actually moved something. A casual game moves no rating, an
 * abandoned one never settled, and a zero is nothing to report — three ways of
 * saying the same thing to somebody scanning a list, and none of them worth a
 * column of noise beside every row.
 *
 * `ranked` is checked as well as the value, rather than trusting a casual game
 * to have left the columns null.
 */
function RatingDelta({
	delta,
	ranked,
}: {
	delta: number | null;
	ranked: boolean;
}) {
	if (!ranked || delta === null || delta === 0) return null;

	return (
		<span
			className={`shrink-0 font-semibold text-xs tabular-nums ${
				delta > 0 ? "text-primary" : "text-danger"
			}`}
		>
			{delta > 0 ? "+" : ""}
			{delta}
		</span>
	);
}
