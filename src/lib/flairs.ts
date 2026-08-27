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

export type Flair = {
	id: string;
	emoji: string;
	/** What the search box matches on, alongside the id. */
	name: string;
	group: FlairGroupId;
};

export const FLAIR_GROUPS: { id: FlairGroupId; label: string }[] = [
	{ id: "chess", label: "Chess" },
	{ id: "special", label: "Special Events" },
	{ id: "membership", label: "Membership" },
	{ id: "emoji", label: "Emoji" },
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

const CHESS: [string, string, string][] = [
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
];

const SPECIAL: [string, string, string][] = [
	["trophy", "🏆", "Champion"],
	["medal", "🥇", "Gold medal"],
	["fireworks", "🎆", "Fireworks"],
	["party", "🎉", "Celebration"],
	["tree", "🎄", "Winter"],
	["pumpkin", "🎃", "Halloween"],
	["egg", "🥚", "Spring"],
	["cake", "🎂", "Birthday"],
];

const MEMBERSHIP: [string, string, string][] = [
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
];

const EMOJI: [string, string, string][] = [
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
];

function build(rows: [string, string, string][], group: FlairGroupId): Flair[] {
	return rows.map(([id, emoji, name]) => ({ id, emoji, name, group }));
}

const FLAIRS: readonly Flair[] = [
	...build(CHESS, "chess"),
	...build(SPECIAL, "special"),
	...build(MEMBERSHIP, "membership"),
	...build(EMOJI, "emoji"),
];

const BY_ID = new Map(FLAIRS.map((flair) => [flair.id, flair]));

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
export function searchFlairs(query: string): readonly Flair[] {
	const needle = query.trim().toLowerCase();
	if (!needle) return FLAIRS;

	return FLAIRS.filter(
		(flair) =>
			flair.name.toLowerCase().includes(needle) || flair.id.includes(needle),
	);
}
