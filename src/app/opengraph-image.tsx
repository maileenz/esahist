import { ImageResponse } from "next/og";
import {
	BRAND_NAME,
	BRAND_TLD,
	MARK_HEIGHT,
	MARK_SHAPES,
	MARK_WIDTH,
} from "@/lib/brand-mark";
import { OG_IMAGE } from "@/lib/seo";
import en from "../../messages/en.json";

/**
 * The picture every shared link turns into — in a chat, a feed, a search result
 * with a large preview.
 *
 * It is drawn rather than checked in as a PNG for the same reason the icon is
 * generated: there is one pawn, in `@/lib/brand-mark`, and a second copy of it
 * in a design file is a copy that goes stale. This route has no params, so Next
 * bakes it once at build time and serves it as a static file.
 *
 * `alt` matters more than it looks. It is what a screen reader announces when
 * somebody shares the link, and it is emitted as `og:image:alt`.
 */
// Both taken from `@/lib/seo`, which is also what writes them into the page's
// `og:image:width` / `og:image:alt` — one set of numbers, one sentence.
export const size = { width: OG_IMAGE.width, height: OG_IMAGE.height };
export const contentType = "image/png";
export const alt = OG_IMAGE.alt;

/**
 * The English tagline, read straight from the reference catalogue rather than
 * through `getTranslations`.
 *
 * Not a shortcut around i18n. Language on this site is a cookie, and the only
 * clients that ever fetch this image — Facebook's scraper, Slack's unfurler,
 * Google's preview crawler — send no cookies at all, so the card is the default
 * locale by definition. Reading the catalogue directly is also what keeps the
 * route static: `getTranslations` would reach for `cookies()` and force this to
 * be rendered again on every request, for a picture that never changes.
 */
const TAGLINE = en.common.metaDescription;

/** Canvas and ink, sampled from the dark theme in `globals.css`. */
const BACKDROP = "#302e2b";
const BOARD_DARK = "#3d3a36";
const BRAND = "#81b64c";
const INK = "#f5f3f1";
const MUTED = "#b6afa7";

/** How big one square is drawn. Four of them just overhang the card's height. */
const SQUARE = 158;

/** How many files of it are visible before the card runs out. */
const BOARD_FILES = 3;

/** The brand rule along the bottom edge, in pixels. */
const RULE = 12;

/**
 * How much of the card the words get.
 *
 * The board occupies the right edge, so the text column stops short of it: a
 * line of type running over a square is the one thing that makes a card of this
 * size unreadable in a feed. Derived rather than guessed, so changing the board
 * moves the text out of its way by itself.
 */
const TEXT_WIDTH = size.width - BOARD_FILES * SQUARE - 80;

/**
 * The corner of a board, named the way a board is named.
 *
 * Built as data rather than looped over indices in the markup, because the
 * squares need keys and an index is the one thing that is not a name. These are
 * the files and ranks that actually fit in the corner — h8 is the top-right
 * square of a real board, which is where this one is anchored.
 */

const BOARD = ["f", "g", "h"].map((file, fileIndex) => ({
	file,
	squares: [8, 7, 6, 5].map((rank, rankIndex) => ({
		name: `${file}${rank}`,
		dark: (fileIndex + rankIndex) % 2 === 0,
	})),
}));

/**
 * A Google font, as the bytes satori needs.
 *
 * `next/font` cannot help here — it hands back CSS class names, and satori
 * needs the file. Two details are load-bearing. The old user-agent string is
 * what makes Google Fonts answer with a TTF: offered a modern one it returns
 * WOFF2, which satori cannot parse. And `text` subsets the file down to the
 * glyphs actually drawn, which is a couple of kilobytes instead of the face.
 *
 * Returns null rather than throwing. A social card in a fallback font beats a
 * route that 500s because a font CDN was slow.
 */
async function loadFont(
	family: string,
	weight: number,
	text: string,
): Promise<ArrayBuffer | null> {
	try {
		const css = await fetch(
			`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&text=${encodeURIComponent(text)}`,
			{ headers: { "User-Agent": "Mozilla/5.0 (Windows NT 6.1)" } },
		).then((response) => (response.ok ? response.text() : ""));

		const url = /src:\s*url\(([^)]+)\)/.exec(css)?.[1];
		if (!url) return null;

		const font = await fetch(url);
		return font.ok ? await font.arrayBuffer() : null;
	} catch {
		return null;
	}
}

/** The pawn, scaled to a height and drawn from the shared shapes. */
function Mark({ height }: { height: number }) {
	const scale = height / MARK_HEIGHT;

	return (
		// biome-ignore lint/a11y/noSvgWithoutTitle: satori rasterises this to a PNG, so there is no accessibility tree for a <title> to land in — it would be drawn as visible text. The alt text is the route's `alt` export.
		<svg
			height={height}
			viewBox={`0 0 ${MARK_WIDTH} ${MARK_HEIGHT}`}
			width={MARK_WIDTH * scale}
			xmlns="http://www.w3.org/2000/svg"
		>
			{/* No <title>: satori has no accessibility tree to put it in and draws
			    it as visible text instead. The card's alt text is `alt` above. */}
			{MARK_SHAPES.map((shape) => {
				if (shape.kind === "rect") {
					return (
						<rect
							fill={shape.fill}
							height={shape.height}
							key={`${shape.x}-${shape.y}-${shape.fill}`}
							rx={shape.rx}
							width={shape.width}
							x={shape.x}
							y={shape.y}
						/>
					);
				}
				if (shape.kind === "circle") {
					return (
						<circle
							cx={shape.cx}
							cy={shape.cy}
							fill={shape.fill}
							key={`${shape.cx}-${shape.cy}-${shape.fill}`}
							r={shape.r}
						/>
					);
				}
				return <path d={shape.d} fill={shape.fill} key={shape.d} />;
			})}
		</svg>
	);
}

export default async function OpenGraphImage() {
	const wordmark = `${BRAND_NAME}${BRAND_TLD}`;

	/*
	 * Two faces, the same pair the site itself is set in: Gluten for the name and
	 * Geist for everything else. One font would have meant the tagline set in a
	 * display face, because satori treats a lone font as the default for every
	 * text node — which is exactly what it did on the first pass.
	 *
	 * Fetched in parallel, and each subset to the string it actually draws.
	 */
	const [brandFace, bodyFace] = await Promise.all([
		loadFont("Gluten", 800, wordmark),
		loadFont("Geist", 400, `${TAGLINE}${wordmark}`),
	]);

	const fonts = [
		...(bodyFace
			? [
					{
						name: "Geist",
						data: bodyFace,
						style: "normal" as const,
						weight: 400 as const,
					},
				]
			: []),
		...(brandFace
			? [
					{
						name: "Gluten",
						data: brandFace,
						style: "normal" as const,
						weight: 800 as const,
					},
				]
			: []),
	];

	return new ImageResponse(
		<div
			style={{
				background: BACKDROP,
				// The brand rule along the bottom edge. A border rather than an
				// absolutely positioned strip: satori resolves `bottom: 0` against the
				// wrong box here and paints one at each end.
				borderBottom: `${RULE}px solid ${BRAND}`,
				display: "flex",
				flexDirection: "column",
				fontFamily: bodyFace ? "Geist" : undefined,
				height: "100%",
				justifyContent: "space-between",
				padding: "72px 80px",
				position: "relative",
				width: "100%",
			}}
		>
			{/*
			 * A board, bled off the right edge. Eight files would leave the card
			 * looking like a diagram; three running off the corner read as the thing
			 * the site is about without competing with the words.
			 */}
			<div
				style={{
					display: "flex",
					// Clipped to stop above the rule. Four ranks are taller than the
					// card by design — without this they paint over the brand bar and
					// it comes out running only half the width.
					height: size.height - RULE,
					overflow: "hidden",
					position: "absolute",
					right: 0,
					top: 0,
				}}
			>
				{BOARD.map(({ file, squares }) => (
					<div key={file} style={{ display: "flex", flexDirection: "column" }}>
						{squares.map((square) => (
							<div
								key={square.name}
								style={{
									// The light squares are the canvas itself, so the board
									// fades into the card rather than sitting on it in a box.
									background: square.dark ? BOARD_DARK : BACKDROP,
									height: SQUARE,
									width: SQUARE,
								}}
							/>
						))}
					</div>
				))}
			</div>

			{/* The lockup. `position: relative` lifts it over the board. */}
			<div
				style={{ alignItems: "center", display: "flex", position: "relative" }}
			>
				<Mark height={124} />
				<div
					style={{
						color: INK,
						fontFamily: brandFace ? "Gluten" : undefined,
						fontSize: 88,
						fontWeight: 800,
						// The word laps over the piece, the way it does in the header.
						marginLeft: -12,
					}}
				>
					{wordmark}
				</div>
			</div>

			<div
				style={{
					display: "flex",
					flexDirection: "column",
					position: "relative",
					// Kept clear of the board so no line of type runs over a square.
					maxWidth: TEXT_WIDTH,
				}}
			>
				<div style={{ color: INK, fontSize: 48, lineHeight: 1.25 }}>
					{TAGLINE}
				</div>
				{/* The domain in plain text: a screenshot of this card, pasted
				    somewhere that strips the link, still says where to go. */}
				<div style={{ color: MUTED, fontSize: 28, marginTop: 22 }}>
					{wordmark}
				</div>
			</div>
		</div>,
		{ ...size, fonts },
	);
}
