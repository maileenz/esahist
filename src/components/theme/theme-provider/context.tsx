"use client";

import { createContext, useCallback, useContext, useState } from "react";

import {
	boardThemeCss,
	resolveBoardTheme,
	resolvePieceSet,
} from "@/lib/themes";

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

export function BoardProvider({
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
