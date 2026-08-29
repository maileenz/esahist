/**
 * Time controls are a fixed whitelist rather than free-form client input.
 * This keeps matchmaking buckets small (a room only ever matches players who
 * asked for the exact same clock) and stops clients inventing 999-hour games.
 *
 * Shared, like `protocol.ts`: the lobby form renders from it and the room
 * resolves join options against it, so the two can never drift apart.
 */

export interface TimeControl {
	id: string;
	label: string;
	initialMs: number;
	incrementMs: number;
	/** The rating pool this clock belongs to. */
	category: "bullet" | "blitz" | "rapid";
}

/**
 * Declaration order is what the lobby renders: the first three of each category
 * are the ones shown before "More time controls" is expanded.
 */
export const TIME_CONTROLS = {
	"1+0": {
		id: "1+0",
		label: "1 min",
		initialMs: 60_000,
		incrementMs: 0,
		category: "bullet",
	},
	"1+1": {
		id: "1+1",
		label: "1 + 1",
		initialMs: 60_000,
		incrementMs: 1_000,
		category: "bullet",
	},
	"2+1": {
		id: "2+1",
		label: "2 + 1",
		initialMs: 120_000,
		incrementMs: 1_000,
		category: "bullet",
	},
	// Sub-minute clocks carry an `s`, because `30+0` already means thirty
	// *minutes* and the ids are written on every game ever played.
	"30s+0": {
		id: "30s+0",
		label: "30 sec",
		initialMs: 30_000,
		incrementMs: 0,
		category: "bullet",
	},
	"20s+1": {
		id: "20s+1",
		label: "20 sec + 1",
		initialMs: 20_000,
		incrementMs: 1_000,
		category: "bullet",
	},
	"3+0": {
		id: "3+0",
		label: "3 min",
		initialMs: 180_000,
		incrementMs: 0,
		category: "blitz",
	},
	"3+2": {
		id: "3+2",
		label: "3 + 2",
		initialMs: 180_000,
		incrementMs: 2_000,
		category: "blitz",
	},
	"5+0": {
		id: "5+0",
		label: "5 min",
		initialMs: 300_000,
		incrementMs: 0,
		category: "blitz",
	},
	"5+3": {
		id: "5+3",
		label: "5 + 3",
		initialMs: 300_000,
		incrementMs: 3_000,
		category: "blitz",
	},
	"10+0": {
		id: "10+0",
		label: "10 min",
		initialMs: 600_000,
		incrementMs: 0,
		category: "rapid",
	},
	"10+5": {
		id: "10+5",
		label: "10 + 5",
		initialMs: 600_000,
		incrementMs: 5_000,
		category: "rapid",
	},
	"15+10": {
		id: "15+10",
		label: "15 + 10",
		initialMs: 900_000,
		incrementMs: 10_000,
		category: "rapid",
	},
	"30+0": {
		id: "30+0",
		label: "30 min",
		initialMs: 1_800_000,
		incrementMs: 0,
		category: "rapid",
	},
	"20+0": {
		id: "20+0",
		label: "20 min",
		initialMs: 1_200_000,
		incrementMs: 0,
		category: "rapid",
	},
	"60+0": {
		id: "60+0",
		label: "60 min",
		initialMs: 3_600_000,
		incrementMs: 0,
		category: "rapid",
	},
} as const satisfies Record<string, TimeControl>;

export type TimeControlId = keyof typeof TIME_CONTROLS;

export type TimeControlCategory = TimeControl["category"];

export const DEFAULT_TIME_CONTROL: TimeControlId = "5+3";

export function isTimeControlId(value: unknown): value is TimeControlId {
	return typeof value === "string" && value in TIME_CONTROLS;
}

export function resolveTimeControl(value: unknown): TimeControl {
	return isTimeControlId(value)
		? TIME_CONTROLS[value]
		: TIME_CONTROLS[DEFAULT_TIME_CONTROL];
}

export const TIME_CONTROL_CATEGORIES = ["bullet", "blitz", "rapid"] as const;

/** Narrows a route segment or a form value to a real pool. */
export function isRatingCategory(value: unknown): value is TimeControlCategory {
	return (
		typeof value === "string" &&
		(TIME_CONTROL_CATEGORIES as readonly string[]).includes(value)
	);
}

/**
 * The glyph only. What a category is *called* is prose and lives in the message
 * catalogue under `categories.*`, keyed by this same id. The clocks above keep
 * their labels, because "5 + 3" and "30 sec" read the same in every language
 * this site speaks.
 */
export const CATEGORY_META: Record<TimeControlCategory, { icon: string }> = {
	bullet: { icon: "🚀" },
	blitz: { icon: "⚡" },
	rapid: { icon: "⏱️" },
};

/** Grouped for the New Game picker — one block per category, in playing order. */
export const TIME_CONTROLS_BY_CATEGORY = TIME_CONTROL_CATEGORIES.map(
	(category) => ({
		category,
		...CATEGORY_META[category],
		options: (Object.values(TIME_CONTROLS) as TimeControl[]).filter(
			(control) => control.category === category,
		),
	}),
);

/** How many per category the picker shows before "More time controls". */
export const FEATURED_PER_CATEGORY = 3;
