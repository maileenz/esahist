"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Chessboard } from "react-chessboard";
import { toast } from "sonner";
import { PieceIcon } from "@/components/chess-pieces";
import { useBoard } from "@/components/theme/theme-provider";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBoardStyles } from "@/hooks/use-board-styles";
import {
	BOARD_THEMES,
	PIECE_SETS,
	resolveBoardTheme,
	resolvePieceSet,
} from "@/lib/themes";

import { api } from "@/trpc/react";

type Tab = "boards" | "pieces";

/**
 * The three-by-three position the preview shows: a rank of black pieces, a rank
 * of white, and an empty rank between them so both square colours are visible
 * with and without a piece on them.
 */
const PREVIEW_POSITION = {
	a3: { pieceType: "bN" },
	b3: { pieceType: "bQ" },
	c3: { pieceType: "bK" },
	a1: { pieceType: "wN" },
	b1: { pieceType: "wQ" },
	c1: { pieceType: "wK" },
};

/**
 * Board & Pieces.
 *
 * The choice is applied to the whole site as you click — the preview is the
 * real board, so there is nothing to imagine — but only written to the account
 * on Save. Cancel puts back what was stored, which is why the saved values are
 * kept separately from the ones being previewed.
 */
export default function BoardSettings({
	initial,
}: {
	initial: { boardTheme: string; pieceSet: string };
}) {
	const t = useTranslations("board");
	const common = useTranslations("common");
	const [tab, setTab] = useState<Tab>("boards");
	const [saved, setSaved] = useState(initial);
	const { boardTheme, pieceSet, apply } = useBoard();

	const dirty = boardTheme !== saved.boardTheme || pieceSet !== saved.pieceSet;

	const utils = api.useUtils();
	const save = api.settings.setAppearance.useMutation({
		onSuccess: (next) => {
			setSaved(next);
			void utils.settings.appearance.invalidate();
			toast.success(t("saved"));
		},
		onError: (error) => {
			apply(saved);
			toast.error(error.message);
		},
	});

	return (
		<div className="flex flex-col gap-5">
			<header>
				<h2 className="font-bold text-fg text-xl">{t("title")}</h2>
				<p className="mt-1 text-muted-foreground text-sm">{t("subtitle")}</p>
			</header>

			<Tabs onValueChange={(next) => setTab(next as Tab)} value={tab}>
				<TabsList>
					<TabsTrigger value="boards">{t("boards")}</TabsTrigger>
					<TabsTrigger value="pieces">{t("pieces")}</TabsTrigger>
				</TabsList>

				<div className="mt-5 flex flex-col gap-5 lg:flex-row">
					<div className="min-w-0 flex-1">
						{/* Radix drops whichever panel is not showing, and that is left
						    alone: seven swatches cost nothing to build again, and a grid
						    this short has no scroll position to lose. */}
						<TabsContent value="boards">
							<Swatches
								items={BOARD_THEMES.map((theme) => ({
									id: theme.id,
									label: theme.label,
									preview: <MiniBoard dark={theme.dark} light={theme.light} />,
								}))}
								onPick={(id) => apply({ boardTheme: id })}
								selected={boardTheme}
							/>
						</TabsContent>

						<TabsContent value="pieces">
							<Swatches
								items={PIECE_SETS.map((set) => ({
									id: set.id,
									label: set.label,
									preview: <MiniPieces set={set.id} />,
								}))}
								onPick={(id) => apply({ pieceSet: id })}
								selected={pieceSet}
							/>
						</TabsContent>
					</div>

					<Preview />
				</div>
			</Tabs>

			<div className="flex gap-3">
				<Button
					disabled={!dirty || save.isPending}
					onClick={() => apply(saved)}
					type="button"
					variant="outline"
				>
					{common("cancel")}
				</Button>
				<Button
					disabled={!dirty || save.isPending}
					onClick={() => save.mutate({ boardTheme, pieceSet })}
					type="button"
				>
					{save.isPending ? common("saving") : common("save")}
				</Button>
			</div>
		</div>
	);
}

/** The grid of choices, with a tick on the one in use. */
function Swatches({
	items,
	selected,
	onPick,
}: {
	items: { id: string; label: string; preview: React.ReactNode }[];
	selected: string;
	onPick: (id: string) => void;
}) {
	return (
		<ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
			{items.map((item) => {
				const active = item.id === selected;

				return (
					<li key={item.id}>
						<button
							aria-pressed={active}
							className={`relative w-full overflow-hidden rounded-lg border-2 transition ${
								active
									? "border-primary"
									: "border-transparent hover:border-line"
							}`}
							onClick={() => onPick(item.id)}
							title={item.label}
							type="button"
						>
							{item.preview}

							{active && (
								<span className="absolute right-1 bottom-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
									<Check aria-hidden className="h-3.5 w-3.5" />
								</span>
							)}
							<span className="sr-only">{item.label}</span>
						</button>
					</li>
				);
			})}
		</ul>
	);
}

function MiniBoard({ light, dark }: { light: string; dark: string }) {
	return (
		<span aria-hidden className="grid aspect-square grid-cols-2">
			<span style={{ backgroundColor: light }} />
			<span style={{ backgroundColor: dark }} />
			<span style={{ backgroundColor: dark }} />
			<span style={{ backgroundColor: light }} />
		</span>
	);
}

/**
 * A set's queen on the *current* squares, so the swatch shows the thing being
 * chosen rather than the thing already chosen.
 *
 * One piece, and the queen because she is the one that tells sets apart: crown,
 * coronet or ring, every set does her differently, while a pawn is a pawn at
 * this size. Showing two meant each had to be drawn at two fifths of the
 * swatch, which spent the space on quantity — the point of the swatch is what
 * the set looks like, and one piece drawn big says that better than two drawn
 * small.
 *
 * Black, because the swatch stands on a light square and that is the pairing
 * with the room to spare.
 */
function MiniPieces({ set }: { set: string }) {
	const { palette } = useBoard();

	return (
		<span
			aria-hidden
			className="flex aspect-square items-center justify-center p-2"
			style={{ backgroundColor: palette.light }}
		>
			<PieceIcon className="size-3/4" code="bQ" set={set} />
		</span>
	);
}

/**
 * The corner of a board — the real component, three squares by three.
 *
 * `chessboardRows` / `chessboardColumns` are what make that possible, and using
 * the board itself is the point: the squares, the piece renderers, the notation
 * and the rounded corners are the same code the game runs, so what is on this
 * card cannot drift from what a member gets when they play. A hand-drawn grid
 * would only be a lookalike, and would have to be kept looking alike by hand.
 */
function Preview() {
	const boardStyles = useBoardStyles();
	const { boardTheme, pieceSet } = useBoard();

	return (
		// `self-start` and the square box are both load-bearing: the board is a
		// grid of `1fr` rows with `height: 100%`, so any height its container is
		// given beyond three columns' worth is handed to the rows and shows up as
		// gaps between them. Stretching to a taller sibling is exactly that.
		<div className="shrink-0 self-start lg:w-64">
			<div className="aspect-square w-full">
				<Chessboard
					options={{
						...boardStyles,
						chessboardColumns: 3,
						chessboardRows: 3,
						position: PREVIEW_POSITION,
						// A preview, not a game: nothing to pick up, nothing to draw on.
						allowDragging: false,
						allowDrawingArrows: false,
						id: "board-preview",
					}}
				/>
			</div>

			<p className="mt-2 text-center text-subtle text-xs">
				{resolveBoardTheme(boardTheme).label} ·{" "}
				{resolvePieceSet(pieceSet).label}
			</p>
		</div>
	);
}
