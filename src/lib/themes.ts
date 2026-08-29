/**
 * Theme catalogue. Two independent axes: the site theme (colours of the page,
 * applied as a class on <html> and read from the CSS tokens in globals.css)
 * and the board theme (the squares themselves).
 *
 * Board palettes live here rather than in CSS because both the squares and the
 * swatches in the picker read from them — the provider injects them as
 * `[data-board="…"]` rules, so there is one source of truth and no drift.
 */

/**
 * The ids are a closed set and typed as one, which is what lets a caller pass
 * `theme.id` straight to `t()` — next-intl types message keys, so a plain
 * `string` would not typecheck. It also means adding a palette here without
 * naming it in `messages/*.json` is a compile error rather than a blank label.
 */
export type SiteThemeId = "light" | "dark" | "midnight" | "parchment";

export interface SiteTheme {
	id: SiteThemeId;
	/** Two-colour preview: page background and accent. */
	swatch: [string, string];
}

// No `label` here or below: the names are prose, and prose lives in the message
// catalogues under `appearance.themes`, `board.themes` and `board.pieceSets`.
export const SITE_THEMES: SiteTheme[] = [
	{ id: "light", swatch: ["#fafafa", "#059669"] },
	{ id: "dark", swatch: ["#18181b", "#10b981"] },
	{ id: "midnight", swatch: ["#0e1526", "#6366f1"] },
	{ id: "parchment", swatch: ["#f2e8d5", "#8b5e34"] },
];

export const SITE_THEME_IDS = SITE_THEMES.map((theme) => theme.id);

export type BoardThemeId =
	| "green"
	| "wood"
	| "blue"
	| "purple"
	| "slate"
	| "coral";

export interface BoardTheme {
	id: BoardThemeId;
	light: string;
	dark: string;
}

export const BOARD_THEMES: BoardTheme[] = [
	{ id: "green", light: "#ebecd0", dark: "#779556" },
	{ id: "wood", light: "#f0d9b5", dark: "#b58863" },
	{ id: "blue", light: "#dee3e6", dark: "#7c9db1" },
	{ id: "purple", light: "#efeff5", dark: "#8877b7" },
	{ id: "slate", light: "#e9e9e9", dark: "#8d8d8d" },
	{ id: "coral", light: "#f6e4dc", dark: "#c98d7d" },
];

export const BOARD_THEME_IDS = BOARD_THEMES.map((theme) => theme.id);

export const DEFAULT_BOARD_THEME = "green";

/**
 * Piece sets.
 *
 * Every set is drawn here, in vector, from shapes this project owns. Adding one
 * is a line here and a component in `components/pieces/`.
 *
 * Nothing loads artwork from `public/` any more: the last set that did was a
 * copy of somebody else's sprites, which is not ours to ship.
 */
export type PieceSetId =
	| "forge"
	| "marble"
	| "origami"
	| "walnut"
	| "ink"
	| "bauhaus";

export interface PieceSet {
	id: PieceSetId;
}

export const PIECE_SETS: PieceSet[] = [
	{ id: "forge" },
	{ id: "marble" },
	{ id: "origami" },
	{ id: "walnut" },
	{ id: "ink" },
	{ id: "bauhaus" },
];

export const PIECE_SET_IDS = PIECE_SETS.map((set) => set.id);

export const DEFAULT_PIECE_SET = "forge";

/**
 * A stored id that no longer exists — a set that has since been removed —
 * resolves to the default rather than throwing, so an old row still renders.
 */
export function resolvePieceSet(id: string | undefined): PieceSet {
	return (
		PIECE_SETS.find((set) => set.id === id) ??
		(PIECE_SETS.find((set) => set.id === DEFAULT_PIECE_SET) as PieceSet)
	);
}

export function resolveBoardTheme(id: string | undefined): BoardTheme {
	return (
		BOARD_THEMES.find((theme) => theme.id === id) ??
		(BOARD_THEMES[0] as BoardTheme)
	);
}

/** `[data-board="…"]` rules, injected once by the provider. */
export function boardThemeCss(): string {
	return BOARD_THEMES.map(
		(theme) =>
			`[data-board="${theme.id}"]{--board-light:${theme.light};--board-dark:${theme.dark}}`,
	).join("");
}
