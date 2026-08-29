/**
 * The pawn, as geometry rather than as a component.
 *
 * `Brand` paints it into the page and the Open Graph card paints it into a PNG,
 * and those are two different renderers — React in the browser, satori inside
 * `next/og`, which understands JSX but not Tailwind and not our components.
 * Sharing the shapes rather than the markup is what stops one drifting off the
 * other: the artwork is described once here, and each renderer only says how to
 * put it on a surface.
 *
 * Renaming the site is still two strings; they moved here so the social card can
 * spell the name the same way the header does.
 */

export const BRAND_NAME = "Esahist";
export const BRAND_TLD = ".ro";

/** The name as it is written anywhere the whole thing is meant: tabs, cards, feeds. */
export const BRAND_FULL_NAME = `${BRAND_NAME}${BRAND_TLD}`;

/**
 * The piece's colours, sampled off the reference logo rather than picked. Two
 * tones and no gradient: a lit face and the side turned away from the light.
 *
 * Literals, not tokens. Everything else on the page follows the theme; a logo
 * must not. `--color-brand` is indigo under Midnight, and a mark that changes
 * colour with the wallpaper is not a mark.
 */
export const MARK_FACE = "#4e9e36";
export const MARK_SHADE = "#2e7a30";

/** The piece's own coordinates, in hundredths of an em. */
export const MARK_WIDTH = 108;
export const MARK_HEIGHT = 165;

/**
 * A shape kind per element the artwork actually uses. A flat list of paths
 * would have been simpler to consume, but converting the collar's rounded rect
 * and the head's circle into path data by hand is how artwork quietly changes
 * shape, so each is kept as what it is and both renderers switch on `kind`.
 */
export type MarkShape =
	| { kind: "path"; d: string; fill: string }
	| {
			kind: "rect";
			x: number;
			y: number;
			width: number;
			height: number;
			rx: number;
			fill: string;
	  }
	| { kind: "circle"; cx: number; cy: number; r: number; fill: string };

/**
 * Four parts — foot, body, collar, head — each a lit shape with its shaded side
 * laid over it. Separate shapes rather than one clipped overlay: a clip needs an
 * id, an id has to be unique per instance, and that would drag the mark into the
 * client for nothing.
 *
 * The shading meets the light down a curve rather than a straight vertical. A
 * straight edge reads as two colours side by side; a curved one reads as a round
 * thing lit from the left, which is the entire job at sixteen pixels.
 *
 * Order is paint order — every shaded half follows the face it sits on.
 */
export const MARK_SHAPES: readonly MarkShape[] = [
	// Foot.
	{
		kind: "path",
		d: "M 22 126 L 86 126 C 94 137 100 145 103 152 C 106 158 102 164 96 164 L 12 164 C 6 164 2 158 5 152 C 8 145 14 137 22 126 Z",
		fill: MARK_FACE,
	},
	{
		kind: "path",
		d: "M 54 126 L 86 126 C 94 137 100 145 103 152 C 106 158 102 164 96 164 L 54 164 C 60 158 60 137 54 126 Z",
		fill: MARK_SHADE,
	},

	// Body.
	{
		kind: "path",
		d: "M 40 70 C 38 89 32 110 22 128 L 86 128 C 76 110 70 89 68 70 Z",
		fill: MARK_FACE,
	},
	{
		kind: "path",
		d: "M 54 70 L 68 70 C 70 89 76 110 86 128 L 54 128 C 57 110 57 89 54 70 Z",
		fill: MARK_SHADE,
	},

	// Collar.
	{ kind: "rect", x: 23, y: 55, width: 62, height: 18, rx: 9, fill: MARK_FACE },
	{
		kind: "path",
		d: "M 54 55 L 76 55 C 81 55 85 59 85 64 C 85 69 81 73 76 73 L 54 73 Z",
		fill: MARK_SHADE,
	},

	// Head.
	{ kind: "circle", cx: 54, cy: 28, r: 28, fill: MARK_FACE },
	{
		kind: "path",
		d: "M 54 0 A 28 28 0 0 1 54 56 C 64 49 70 39 70 28 C 70 17 64 7 54 0 Z",
		fill: MARK_SHADE,
	},
];
