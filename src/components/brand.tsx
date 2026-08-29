import {
	BRAND_FULL_NAME,
	BRAND_NAME,
	BRAND_TLD,
	MARK_HEIGHT,
	MARK_SHAPES,
	MARK_WIDTH,
} from "@/lib/brand-mark";
import { cn } from "@/lib/utils";

/**
 * The piece's size on the page.
 *
 * Written as literals, and the arithmetic behind them lives here rather than in
 * the bundle: Tailwind scans source text for class names, so a class assembled
 * from a constant is never generated.
 *
 * The height is 2.12 cap heights — the piece is sized against the capitals
 * rather than the em, because the capitals are what it stands beside. Gluten
 * puts its cap at 0.6406 of the em, so 2.12 × 0.6406 = 1.3581em, and the width
 * is that times the artwork's own 108/165. **Swap the brand face and both
 * numbers move**: Plus Jakarta Sans, which this used to be set in, has a cap of
 * 0.745, which would make the same piece 1.5794em.
 */
const MARK_SIZE = "h-[1.62972em] w-[1.06668em]";

/**
 * The piece, in React's dialect of SVG.
 *
 * The artwork itself — the shapes, their order and their two tones — lives in
 * `@/lib/brand-mark`, because the social card has to draw the same pawn through
 * a renderer that has never heard of this component. All that is left here is
 * the translation from a shape to an element.
 */
function PawnGlyph() {
	return (
		<>
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
		</>
	);
}

/**
 * The piece on its own, for anywhere the name is already obvious — a favicon, a
 * square avatar, a collapsed rail.
 */
export function BrandMark({
	className,
	decorative = false,
}: {
	className?: string;
	/** True when the name is written beside it, so it needs none of its own. */
	decorative?: boolean;
}) {
	return (
		// biome-ignore lint/a11y/noSvgWithoutTitle: the title is built from the brand constants, which the rule cannot evaluate and so reads as empty
		<svg
			aria-hidden={decorative || undefined}
			className={cn("inline-block", MARK_SIZE, className)}
			fill="none"
			role={decorative ? undefined : "img"}
			viewBox={`0 0 ${MARK_WIDTH} ${MARK_HEIGHT}`}
			xmlns="http://www.w3.org/2000/svg"
		>
			{/* Omitted, not just hidden, when the name is written beside it: an
			    aria-hidden title is still DOM text, and selecting the lockup would
			    copy the name twice. */}
			{!decorative && <title>{BRAND_FULL_NAME}</title>}
			<PawnGlyph />
		</svg>
	);
}

/**
 * The lockup: the piece, and the name lapping over it.
 *
 * A flex row centred on the cross axis, with the word pulled back over the
 * piece by `-space-x-2`. Note that is a fixed half-rem rather than a share of
 * the type size, so the overlap is proportionally deeper in the drawer at 18px
 * than on the login card at 36px.
 *
 * The name is live text, which is what keeps it selectable, searchable and
 * announced without an `aria-label` standing in for it — and it is what lets the
 * curve of Gluten's E do the work of tucking into the piece. The `.ro` drops to
 * 0.63 of the size and to the regular grade, both measured off the reference.
 */
export default function Brand({
	className,
	wordmark = true,
}: {
	className?: string;
	/** False for tight spots — the piece alone is the mark. */
	wordmark?: boolean;
}) {
	if (!wordmark) return <BrandMark className={className} />;

	return (
		<span
			className={cn(
				"flex items-center -space-x-2.25 whitespace-nowrap font-brand font-extrabold text-fg",
				className,
			)}
		>
			<BrandMark className="-mt-1.75" decorative />

			{/* `relative` so the word paints over the piece rather than under it,
			    and the halo keeps their edges apart where they cross. */}
			<span className="brand-outline relative mt-1">
				{BRAND_NAME}
				<span className="font-normal text-[0.63em]">{BRAND_TLD}</span>
			</span>
		</span>
	);
}
