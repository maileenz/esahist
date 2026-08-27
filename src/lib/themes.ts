/**
 * Theme catalogue. Two independent axes: the site theme (colours of the page,
 * applied as a class on <html> and read from the CSS tokens in globals.css)
 * and the board theme (the squares themselves).
 *
 * Board palettes live here rather than in CSS because both the squares and the
 * swatches in the picker read from them — the provider injects them as
 * `[data-board="…"]` rules, so there is one source of truth and no drift.
 */

export interface SiteTheme {
	id: string;
	label: string;
	/** Two-colour preview: page background and accent. */
	swatch: [string, string];
}

export const SITE_THEMES: SiteTheme[] = [
	{ id: "light", label: "Light", swatch: ["#fafafa", "#059669"] },
	{ id: "dark", label: "Dark", swatch: ["#18181b", "#10b981"] },
	{ id: "midnight", label: "Midnight", swatch: ["#0e1526", "#6366f1"] },
	{ id: "parchment", label: "Parchment", swatch: ["#f2e8d5", "#8b5e34"] },
];

export const SITE_THEME_IDS = SITE_THEMES.map((theme) => theme.id);

export interface BoardTheme {
	id: string;
	label: string;
	light: string;
	dark: string;
}

export const BOARD_THEMES: BoardTheme[] = [
	{ id: "green", label: "Green", light: "#ebecd0", dark: "#779556" },
	{ id: "wood", label: "Wood", light: "#f0d9b5", dark: "#b58863" },
	{ id: "blue", label: "Ocean", light: "#dee3e6", dark: "#7c9db1" },
	{ id: "purple", label: "Amethyst", light: "#efeff5", dark: "#8877b7" },
	{ id: "slate", label: "Slate", light: "#e9e9e9", dark: "#8d8d8d" },
	{ id: "coral", label: "Coral", light: "#f6e4dc", dark: "#c98d7d" },
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
export interface PieceSet {
	id: string;
	label: string;
}

export const PIECE_SETS: PieceSet[] = [
	{ id: "forge", label: "Forge" },
	{ id: "marble", label: "Marble" },
	{ id: "origami", label: "Origami" },
	{ id: "walnut", label: "Walnut" },
	{ id: "ink", label: "Ink" },
	{ id: "bauhaus", label: "Bauhaus" },
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
