"use client";

import { Clock, User } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { CapturedPieces } from "@/components/captured-pieces";
import Flag from "@/components/flag";
import Flair from "@/components/flair";
import MemberAvatar from "@/components/member-avatar";
import { formatClock } from "@/hooks/use-chess-game";
import { cn } from "@/lib/utils";

/**
 * One seat: who is sitting in it, what they have taken, and their clock.
 *
 * Shared by the live board and the replay, which is the whole reason it left
 * `chess-game.tsx`. A finished game is the same seat with the clock stopped —
 * before this, the replay had a plainer one of its own and a member appeared
 * two different ways depending on whether the game was still going.
 *
 * Everything past the name is optional and simply absent when it does not
 * apply: no clock on the lobby's empty board, no captured strip before anything
 * has been taken, no delta on a casual game.
 */
export function PlayerBar({
	name,
	username = null,
	rating = null,
	delta = null,
	title = null,
	country = null,
	flair = null,
	image = null,
	online = null,
	captured = [],
	advantage = 0,
	clockMs = null,
	active = false,
	running = false,
}: {
	name: string | null;
	/** Links the name to the member's profile. Null for guests and empty seats. */
	username?: string | null;
	rating?: number | null;
	/** What the game did to that rating, once it is over. */
	delta?: number | null;
	/** Federation title — FM, IM, GM. Rendered as a chip before the name. */
	title?: string | null;
	country?: string | null;
	flair?: string | null;
	image?: string | null;
	/** Live presence. Omit on a finished game — there is nobody to be online. */
	online?: boolean | null;
	/** Piece codes this player has taken, e.g. `["bP", "bN"]`. */
	captured?: string[];
	/** Their material edge; only shown when they are ahead. */
	advantage?: number;
	/** Omit for a seat with no game attached — the pill is then not drawn. */
	clockMs?: number | null;
	/** Whose turn it is: the running clock is the filled one. */
	active?: boolean;
	/**
	 * Whether that clock is actually counting down.
	 *
	 * Narrower than `active`, and deliberately: a replay marks the side to move
	 * so the filled pill still says whose turn it was, but nothing is ticking in
	 * a finished game, and nothing is ticking on the lobby board either.
	 */
	running?: boolean;
}) {
	const t = useTranslations("game");
	return (
		<div className="flex items-center justify-between gap-3">
			<div className="flex min-w-0 gap-2.5">
				<SeatAvatar
					image={image}
					name={name ?? username ?? "?"}
					online={online}
					seated={Boolean(username)}
				/>

				<div className="flex min-w-0 flex-col">
					<div className="flex min-w-0 items-center gap-1 text-sm leading-4!">
						{title && (
							<span className="shrink-0 rounded bg-danger px-1 py-px font-bold text-[10px] text-white leading-tight">
								{title}
							</span>
						)}

						{username ? (
							<Link
								className="truncate font-bold text-fg hover:underline"
								href={`/member/${username}`}
							>
								{username}
							</Link>
						) : (
							<span className="truncate font-bold text-fg">
								{name ?? t("waiting")}
							</span>
						)}

						{rating !== null && (
							<span className="shrink-0 text-muted-foreground tabular-nums">
								({rating})
							</span>
						)}

						{delta !== null && delta !== 0 && (
							<span
								className={cn(
									"shrink-0 font-semibold text-sm tabular-nums",
									delta > 0 ? "text-primary" : "text-danger",
								)}
							>
								{delta > 0 ? "+" : ""}
								{delta}
							</span>
						)}

						<Flag className="shrink-0 rounded-xs" code={country} />
						<Flair id={flair} />
					</div>

					{(captured.length > 0 || advantage > 0) && (
						<div className="mt-0.5 flex items-center gap-1.5">
							<CapturedPieces pieces={captured} />
							{advantage > 0 && (
								<span className="text-muted-foreground text-xs tabular-nums">
									+{advantage}
								</span>
							)}
						</div>
					)}
				</div>
			</div>

			{clockMs !== null && (
				<span
					className={cn(
						"flex h-10 shrink-0 items-center gap-2 rounded-md px-3 font-bold font-mono text-2xl tabular-nums",
						active ? "bg-fg text-surface" : "bg-elevated text-muted-foreground",
					)}
				>
					{/* The icon is the clock *running*, not the clock existing. It
					    appears on the seat whose move it is in a live game and nowhere
					    else. The pill is anchored to the right of the row, so it grows
					    and shrinks from the left and the digits never move. */}
					{running && <Clock aria-hidden className="h-4 w-4 opacity-70" />}
					{formatClock(clockMs)}
				</span>
			)}
		</div>
	);
}

/**
 * The room state carries no avatar for a seat nobody has taken, so that case
 * gets a placeholder. The dot is presence: lit while their socket is up, grey
 * once it drops and the seat is being held — and absent entirely on a replay,
 * where a game that ended last week has no one to be online.
 */
function SeatAvatar({
	image,
	name,
	seated,
	online,
}: {
	image: string | null;
	name: string;
	/** False for a chair nobody has sat in yet. */
	seated: boolean;
	online: boolean | null;
}) {
	return (
		<span className="relative shrink-0">
			<MemberAvatar
				className="size-10 rounded-lg"
				fallback={
					// "Opponent" and "You" are placeholders, not names — an initial
					// taken from one would be meaningless.
					seated ? undefined : <User aria-hidden className="h-6 w-6" />
				}
				image={image}
				name={name}
			/>

			{online !== null && (
				<span
					aria-hidden
					className={cn(
						"absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-full border-2 border-surface",
						online ? "bg-primary" : "bg-subtle",
					)}
				/>
			)}
		</span>
	);
}
