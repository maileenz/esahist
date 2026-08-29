/**
 * Flairs: the little emoji a member wears beside their handle.
 *
 * A catalogue rather than free text. Storing the id and not the character is
 * what lets a flair be searched by name, grouped, gated behind membership, and
 * retired later without rewriting rows — and it stops the column becoming a
 * place to paste four hundred bytes of zalgo next to somebody's username.
 *
 * Ids are permanent. Renaming one orphans everybody wearing it.
 */

export type FlairGroupId = "chess" | "special" | "membership" | "emoji";

/**
 * Read back off the tables below, so the union cannot drift from the data.
 *
 * It also makes the ids usable as message keys: next-intl types `t()`, so a
 * flair added here without a name in `messages/*.json` is a compile error
 * rather than a tooltip that silently reads "flairs.dragon".
 */
export type FlairId =
	| (typeof CHESS)[number][0]
	| (typeof SPECIAL)[number][0]
	| (typeof MEMBERSHIP)[number][0]
	| (typeof EMOJI)[number][0];

export type Flair = {
	id: FlairId;
	emoji: string;
	/**
	 * The English name. Kept as the fallback and as what `searchFlairs` matches
	 * when no translated names are handed to it — the catalogue under `flairs.*`
	 * is what a reader actually sees.
	 */
	name: string;
	group: FlairGroupId;
};

// Names come from `profileSettings.flairGroups`, not from here.
export const FLAIR_GROUPS: { id: FlairGroupId }[] = [
	{ id: "chess" },
	{ id: "special" },
	{ id: "membership" },
	{ id: "emoji" },
];

/**
 * Members only.
 *
 * The one group that is not simply decoration: it is the visible half of the
 * thing they are paying for, which is why entitlement is checked on the server
 * when a flair is saved rather than only hidden in the picker.
 */
export const MEMBER_ONLY_GROUPS: ReadonlySet<FlairGroupId> = new Set([
	"membership",
]);

const CHESS = [
	["pawn", "♟️", "Pawn"],
	["knight", "♞", "Knight"],
	["bishop", "♝", "Bishop"],
	["rook", "♜", "Rook"],
	["queen", "♛", "Queen"],
	["king", "♚", "King"],
	["board", "🏁", "Checkered"],
	["brain", "🧠", "Brain"],
	["clock", "⏱️", "Clock"],
	["handshake", "🤝", "Good game"],
] as const;

const SPECIAL = [
	["trophy", "🏆", "Champion"],
	["medal", "🥇", "Gold medal"],
	["fireworks", "🎆", "Fireworks"],
	["party", "🎉", "Celebration"],
	["tree", "🎄", "Winter"],
	["pumpkin", "🎃", "Halloween"],
	["egg", "🥚", "Spring"],
	["cake", "🎂", "Birthday"],
] as const;

const MEMBERSHIP = [
	["diamond", "💎", "Diamond"],
	["crown", "👑", "Crown"],
	["star", "⭐", "Star"],
	["glowing-star", "🌟", "Glowing star"],
	["sparkles", "✨", "Sparkles"],
	["gem-blue", "🔷", "Blue gem"],
	["gem-orange", "🔶", "Orange gem"],
	["rosette", "🏵️", "Rosette"],
	["ribbon", "🎗️", "Ribbon"],
	["comet", "☄️", "Comet"],
] as const;

const EMOJI = [
	["grinning", "😀", "Grinning"],
	["smile", "😄", "Smile"],
	["joy", "😂", "Tears of joy"],
	["wink", "😉", "Wink"],
	["cool", "😎", "Cool"],
	["nerd", "🤓", "Nerd"],
	["thinking", "🤔", "Thinking"],
	["sweat", "😅", "Nervous"],
	["cry", "😭", "Crying"],
	["scream", "😱", "Scream"],
	["angry", "😠", "Angry"],
	["devil", "😈", "Mischief"],
	["sleepy", "😴", "Sleepy"],
	["hearts", "😍", "Heart eyes"],
	["heart", "❤️", "Heart"],
	["fire", "🔥", "Fire"],
	["rocket", "🚀", "Rocket"],
	["rainbow", "🌈", "Rainbow"],
	["thumbs-up", "👍", "Thumbs up"],
	["clap", "👏", "Applause"],
	["muscle", "💪", "Strong"],
	["wave", "👋", "Wave"],
	["peace", "✌️", "Peace"],
	["pray", "🙏", "Please"],
	["eyes", "👀", "Watching"],
	["skull", "💀", "Skull"],
	["ghost", "👻", "Ghost"],
	["alien", "👽", "Alien"],
	["robot", "🤖", "Robot"],
	["cat", "🐱", "Cat"],
	["dog", "🐶", "Dog"],
	["fox", "🦊", "Fox"],
	["owl", "🦉", "Owl"],
	["penguin", "🐧", "Penguin"],
	["dragon", "🐲", "Dragon"],
	["coffee", "☕", "Coffee"],
	["pizza", "🍕", "Pizza"],
	["moon", "🌙", "Moon"],
	["sun", "☀️", "Sun"],
	["snow", "❄️", "Snow"],
] as const;

function build(
	rows: readonly (readonly [string, string, string])[],
	group: FlairGroupId,
): Flair[] {
	return rows.map(([id, emoji, name]) => ({
		id: id as FlairId,
		emoji,
		name,
		group,
	}));
}

const FLAIRS: readonly Flair[] = [
	...build(CHESS, "chess"),
	...build(SPECIAL, "special"),
	...build(MEMBERSHIP, "membership"),
	...build(EMOJI, "emoji"),
];

// Keyed by plain string, not FlairId: every caller below is handed something
// untrusted — a column, a form field, a URL — and deciding whether it names a
// flair is exactly what they are for.
const BY_ID = new Map<string, Flair>(FLAIRS.map((flair) => [flair.id, flair]));

/** `null` for "none" and for an id that no longer names anything. */
export function flairById(id: string | null | undefined): Flair | null {
	return id ? (BY_ID.get(id) ?? null) : null;
}

export function isFlairId(value: unknown): value is string {
	return typeof value === "string" && BY_ID.has(value);
}

/** Whether wearing this one requires a membership. */
export function flairNeedsMembership(id: string): boolean {
	const flair = BY_ID.get(id);
	return flair ? MEMBER_ONLY_GROUPS.has(flair.group) : false;
}

/**
 * The picker's search. Matches the name and the id, so both "crown" and "gold
 * medal" find what you would expect; an empty query is the whole catalogue.
 */
/**
 * `name` lets a caller search the list in the reader's own language. Without it
 * this falls back to the English names, which is right for anything with no
 * React context to read a locale from.
 *
 * The id is always matched too, so "queen" still finds Dama.
 */
export function searchFlairs(
	query: string,
	name: (flair: Flair) => string = (flair) => flair.name,
): readonly Flair[] {
	const needle = query.trim().toLowerCase();
	if (!needle) return FLAIRS;

	return FLAIRS.filter(
		(flair) =>
			name(flair).toLowerCase().includes(needle) || flair.id.includes(needle),
	);
}
