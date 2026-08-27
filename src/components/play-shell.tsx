"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { BoardLayout } from "@/components/board-layout";
import { Button } from "@/components/ui/button";
import { useChessGame } from "@/hooks/use-chess-game";
import {
	DEFAULT_TIME_CONTROL,
	isTimeControlId,
	TIME_CONTROLS,
} from "@/lib/timeControls";
import type { RatingPools } from "@/server/db/ratings";
import { GameBoard, GamePanel, IdleBoard } from "./chess-game";
import GameSetup, { type GameSettings } from "./game-setup";

/**
 * Board on the left, panel on the right — the board is there the whole time and
 * only the right column changes: New Game form, queue, then the live game. The
 * connection hook stays mounted across all of it, so the socket (and the
 * reconnection token behind a refresh) survives going back to the lobby.
 */
export default function PlayShell({
	ratings,
	seat,
	initialTimeControl,
}: {
	/** Every pool: which one is at stake changes with the clock you pick. */
	ratings: RatingPools;
	/** The signed-in member, for the bottom seat. */
	seat: {
		username: string;
		image: string | null;
		country: string | null;
		flair: string | null;
	};
	/** From `?tc=`; ignored unless it is one of the whitelisted clocks. */
	initialTimeControl?: string;
}) {
	const t = useTranslations("lobby");
	const common = useTranslations("common");
	const [settings, setSettings] = useState<GameSettings>({
		timeControl: isTimeControlId(initialTimeControl)
			? initialTimeControl
			: DEFAULT_TIME_CONTROL,
		ranked: true,
	});

	// A bullet rating must not put you in a rapid queue, so the bucket comes
	// from the pool the chosen clock belongs to.
	const control = TIME_CONTROLS[settings.timeControl];
	const pool = ratings[control.category];

	const game = useChessGame({
		...settings,
		rating: pool.rating,
		autoJoin: false,
	});
	const inGame = game.phase === "playing" || game.phase === "over";

	return (
		<BoardLayout
			board={
				inGame ? (
					<GameBoard game={game} />
				) : (
					<IdleBoard
						clockMs={control.initialMs}
						rating={pool.established ? pool.rating : null}
						seat={seat}
					/>
				)
			}
			panel={
				game.phase === "error" ? (
					<Panel>
						<p className="text-fg">{game.error ?? t("genericError")}</p>
						<div className="mt-4 flex gap-2">
							<Button onClick={() => void game.findGame()} type="button">
								{common("retry")}
							</Button>
							<Button onClick={game.leave} type="button" variant="outline">
								{t("backToLobby")}
							</Button>
						</div>
					</Panel>
				) : game.phase === "idle" ? (
					<GameSetup
						onChange={setSettings}
						onPlay={() => void game.findGame()}
						settings={settings}
					/>
				) : inGame ? (
					<GamePanel game={game} onNewGame={game.leave} />
				) : (
					<Searching
						label={control.label}
						onCancel={game.cancelSearch}
						ranked={settings.ranked}
					/>
				)
			}
		/>
	);
}

function Searching({
	label,
	ranked,
	onCancel,
}: {
	label: string;
	ranked: boolean;
	onCancel: () => void;
}) {
	const t = useTranslations("lobby");
	const common = useTranslations("common");
	const seconds = useElapsedSeconds();

	return (
		<Panel>
			<div className="flex items-center gap-3">
				<div
					aria-hidden
					className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-primary"
				/>
				<div>
					<p className="font-semibold text-fg">{t("searching")}</p>
					<p className="text-muted-foreground text-sm">
						{t("searchingDetail", {
							control: label,
							mode: ranked ? t("rated") : t("casual"),
							seconds,
						})}
					</p>
				</div>
			</div>
			<p className="mt-3 text-muted-foreground text-sm">{t("seatedSoon")}</p>
			<Button
				className="mt-4 w-full"
				onClick={onCancel}
				type="button"
				variant="outline"
			>
				{common("cancel")}
			</Button>
		</Panel>
	);
}

function useElapsedSeconds(): number {
	const [seconds, setSeconds] = useState(0);
	useEffect(() => {
		const id = setInterval(() => setSeconds((value) => value + 1), 1000);
		return () => clearInterval(id);
	}, []);
	return seconds;
}

function Panel({ children }: { children: React.ReactNode }) {
	return (
		<div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
			{children}
		</div>
	);
}
