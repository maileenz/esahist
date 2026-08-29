import type { BotStrength } from "./bot";

/**
 * The opponents a visitor can pick from, and how hard each of them plays.
 *
 * A roster rather than three difficulty buttons, because "Medium" tells nobody
 * anything. A name, a face and a number do: a rating is the one unit every
 * chess player already reads, and picking somebody a hundred points above you
 * is a decision you can make without a manual.
 *
 * Everything here is data — the strength is derived from the rating by
 * `strengthFor`, so adding a bot is one line and cannot get out of step with
 * how it plays.
 */

export interface Bot {
	/** Stable across renders and stored nowhere else; used as a React key. */
	id: string;
	name: string;
	/** What the number under the face says, and the only handle on difficulty. */
	rating: number;
	/** ISO 3166-1 alpha-2, drawn by the same `Flag` component members use. */
	country: string;
	/**
	 * The tile behind the initial.
	 *
	 * A literal rather than a theme token, for the same reason the brand mark is:
	 * a face that changed colour with the wallpaper would stop being that bot's
	 * face. Chosen to stay legible against white text in both themes.
	 */
	accent: string;
}

/**
 * The group names are message keys, so they are a union rather than `string`.
 * next-intl types `t()` against the catalogue, and a plain string cannot index
 * it — this is what makes `t(`groups.${id}`)` check at compile time instead of
 * printing a missing key at runtime.
 */
export type BotGroupId =
	| "newToChess"
	| "beginner"
	| "intermediate"
	| "advanced"
	| "master";

export interface BotGroup {
	id: BotGroupId;
	bots: Bot[];
}

/**
 * How a rating becomes search settings.
 *
 * Noise does most of the work and depth does the rest, which is the right way
 * round: a beginner's opponent should blunder, not merely think shallowly. A
 * depth-1 engine with no noise still never hangs a piece and still plays the
 * same game twice, which is neither weak nor human.
 *
 * The bands are a table rather than a formula so each one can be felt and
 * adjusted on its own — the difference between a 400 and an 800 is not the same
 * as the difference between a 1600 and a 2000.
 */
export function strengthFor(rating: number): BotStrength {
	if (rating < 500) return { maxDepth: 1, budgetMs: 80, noise: 260 };
	if (rating < 800) return { maxDepth: 1, budgetMs: 100, noise: 150 };
	if (rating < 1100) return { maxDepth: 2, budgetMs: 150, noise: 90 };
	if (rating < 1400) return { maxDepth: 2, budgetMs: 220, noise: 45 };
	if (rating < 1700) return { maxDepth: 3, budgetMs: 320, noise: 20 };
	if (rating < 2000) return { maxDepth: 4, budgetMs: 450, noise: 5 };
	return { maxDepth: 5, budgetMs: 650, noise: 0 };
}

/**
 * The roster, weakest group first.
 *
 * Group ids are message keys — the names are prose and belong in the catalogue
 * — while bot names are proper nouns and are not translated, the same rule the
 * brand follows.
 */
export const BOT_GROUPS: BotGroup[] = [
	{
		id: "newToChess",
		bots: [
			{
				id: "pixel",
				name: "Pixel",
				rating: 250,
				country: "RO",
				accent: "#e07a5f",
			},
			{
				id: "mimi",
				name: "Mimi",
				rating: 350,
				country: "FR",
				accent: "#8d6cab",
			},
			{
				id: "bruno",
				name: "Bruno",
				rating: 450,
				country: "IT",
				accent: "#5f8fe0",
			},
			{
				id: "kata",
				name: "Kata",
				rating: 550,
				country: "JP",
				accent: "#3fa796",
			},
			{
				id: "otto",
				name: "Otto",
				rating: 650,
				country: "DE",
				accent: "#c9843e",
			},
		],
	},
	{
		id: "beginner",
		bots: [
			{
				id: "ilinca",
				name: "Ilinca",
				rating: 750,
				country: "RO",
				accent: "#d2607f",
			},
			{ id: "sam", name: "Sam", rating: 850, country: "GB", accent: "#4f7cac" },
			{
				id: "nuri",
				name: "Nuri",
				rating: 950,
				country: "TR",
				accent: "#b5651d",
			},
			{
				id: "lena",
				name: "Lena",
				rating: 1000,
				country: "PL",
				accent: "#7a9e5a",
			},
			{
				id: "diego",
				name: "Diego",
				rating: 1050,
				country: "AR",
				accent: "#5b8fa8",
			},
		],
	},
	{
		id: "intermediate",
		bots: [
			{
				id: "radu",
				name: "Radu",
				rating: 1150,
				country: "RO",
				accent: "#6a7fbf",
			},
			{
				id: "ana",
				name: "Ana",
				rating: 1250,
				country: "ES",
				accent: "#c25b6f",
			},
			{
				id: "viktor",
				name: "Viktor",
				rating: 1350,
				country: "SE",
				accent: "#4a8c7c",
			},
			{
				id: "priya",
				name: "Priya",
				rating: 1400,
				country: "IN",
				accent: "#b8722e",
			},
			{
				id: "jonas",
				name: "Jonas",
				rating: 1450,
				country: "NL",
				accent: "#7169a8",
			},
		],
	},
	{
		id: "advanced",
		bots: [
			{
				id: "mira",
				name: "Mira",
				rating: 1550,
				country: "MD",
				accent: "#a4573f",
			},
			{
				id: "kwame",
				name: "Kwame",
				rating: 1650,
				country: "GH",
				accent: "#3f8f6a",
			},
			{
				id: "sofia",
				name: "Sofia",
				rating: 1700,
				country: "BR",
				accent: "#c05c8e",
			},
			{
				id: "arto",
				name: "Arto",
				rating: 1800,
				country: "FI",
				accent: "#4d7ea8",
			},
			{
				id: "hana",
				name: "Hana",
				rating: 1850,
				country: "CZ",
				accent: "#8a6bb0",
			},
		],
	},
	{
		id: "master",
		bots: [
			{
				id: "tudor",
				name: "Tudor",
				rating: 1950,
				country: "RO",
				accent: "#365f8a",
			},
			{
				id: "irina",
				name: "Irina",
				rating: 2050,
				country: "UA",
				accent: "#9c4f6c",
			},
			{
				id: "magnus",
				name: "Magnús",
				rating: 2150,
				country: "IS",
				accent: "#2f7d6b",
			},
			{
				id: "wei",
				name: "Wei",
				rating: 2250,
				country: "CN",
				accent: "#a8552f",
			},
			{
				id: "sable",
				name: "Sable",
				rating: 2400,
				country: "US",
				accent: "#2e2e38",
			},
		],
	},
];

/** Every bot, flattened — for lookups by id. */
export const ALL_BOTS: Bot[] = BOT_GROUPS.flatMap((group) => group.bots);

/**
 * Who a visitor meets first.
 *
 * Deliberately not the weakest one. The opening screen should look like a game
 * worth playing rather than a tutorial, and somebody who wants easier is one
 * click away in a group that is already open.
 */
export const DEFAULT_BOT: Bot =
	ALL_BOTS.find((bot) => bot.id === "ilinca") ?? (ALL_BOTS[0] as Bot);
