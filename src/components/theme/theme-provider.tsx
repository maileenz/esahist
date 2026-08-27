"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { createContext, useCallback, useContext, useState } from "react";

import {
	boardThemeCss,
	resolveBoardTheme,
	resolvePieceSet,
	SITE_THEME_IDS,
} from "@/lib/themes";

/**
 * Two independent axes: the site palette and the board.
 *
 * next-themes owns the site palette. It cannot own both — a nested
 * `ThemeProvider` sees the outer context and returns its children untouched
 * ("Ignore nested context providers"), so the second instance would silently do
 * nothing and `useTheme()` would resolve to whichever one won.
 *
 * The board axis is a small provider of its own, and unlike the site theme it
 * is *stored on the account*: the server already knows it, renders
 * `data-board` into the HTML, and hands the same values here as the starting
 * state. There is no blocking script and no `localStorage` — nothing to settle
 * before the first paint, because it was never unsettled.
 */
export function ThemeProviders({
	appearance,
	children,
}: {
	appearance: { boardTheme: string; pieceSet: string };
	children: React.ReactNode;
}) {
	return (
		<NextThemesProvider
			attribute="class"
			defaultTheme="system"
			disableTransitionOnChange
			enableSystem
			storageKey="site-theme"
			themes={SITE_THEME_IDS}
		>
			<BoardProvider appearance={appearance}>{children}</BoardProvider>
		</NextThemesProvider>
	);
}

interface BoardApi {
	boardTheme: string;
	pieceSet: string;
	palette: ReturnType<typeof resolveBoardTheme>;
	/**
	 * Paints a choice immediately, for the settings preview and for the moment
	 * after Save. Persisting is the caller's job — this only moves the pixels.
	 */
	apply: (next: { boardTheme?: string; pieceSet?: string }) => void;
}

const BoardContext = createContext<BoardApi | null>(null);

function BoardProvider({
	appearance,
	children,
}: {
	appearance: { boardTheme: string; pieceSet: string };
	children: React.ReactNode;
}) {
	const [board, setBoard] = useState(appearance);

	const apply = useCallback((next: Partial<typeof appearance>) => {
		setBoard((current) => {
			const merged = {
				boardTheme: resolveBoardTheme(next.boardTheme ?? current.boardTheme).id,
				pieceSet: resolvePieceSet(next.pieceSet ?? current.pieceSet).id,
			};
			// The squares read `--board-light` / `--board-dark` off this attribute;
			// the pieces are React and re-render from the state below.
			document.documentElement.setAttribute("data-board", merged.boardTheme);
			return merged;
		});
	}, []);

	return (
		<BoardContext.Provider
			value={{
				...board,
				palette: resolveBoardTheme(board.boardTheme),
				apply,
			}}
		>
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: built from the static catalogue in `lib/themes.ts`, never user input. */}
			<style dangerouslySetInnerHTML={{ __html: boardThemeCss() }} />
			{children}
		</BoardContext.Provider>
	);
}

export function useBoard(): BoardApi {
	const context = useContext(BoardContext);
	if (!context) {
		throw new Error("useBoard must be used inside <ThemeProviders>");
	}
	return context;
}
