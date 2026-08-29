import { ImageResponse } from "next/og";

import { MARK_HEIGHT, MARK_SHAPES, MARK_WIDTH } from "@/lib/brand-mark";

/**
 * The home-screen icon on iOS, at `/apple-icon`.
 *
 * A PNG rather than the SVG the rest of the site uses, because Safari still
 * will not take a vector here — and drawn rather than checked in, so it comes
 * from the same shapes as everything else and cannot drift.
 *
 * iOS composites this onto the home screen with its own rounded mask and no
 * transparency, so the background is painted: left transparent, it comes out
 * black on a dark wallpaper.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
	// The same inset as the manifest icon: the piece sits in the middle, with
	// room for the mask to take the corners.
	const scale = (size.height * 0.62) / MARK_HEIGHT;

	return new ImageResponse(
		<div
			style={{
				alignItems: "center",
				background: "#edebe9",
				display: "flex",
				height: "100%",
				justifyContent: "center",
				width: "100%",
			}}
		>
			{/* biome-ignore lint/a11y/noSvgWithoutTitle: satori rasterises this to a PNG, so there is no accessibility tree for a title to land in — it would be drawn as visible text instead. */}
			<svg
				height={MARK_HEIGHT * scale}
				viewBox={`0 0 ${MARK_WIDTH} ${MARK_HEIGHT}`}
				width={MARK_WIDTH * scale}
				xmlns="http://www.w3.org/2000/svg"
			>
				{/* No <title>: satori has no accessibility tree to put it in and
				    draws it as visible text instead. */}
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
		</div>,
		size,
	);
}
