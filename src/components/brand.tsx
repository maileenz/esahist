import { cn } from "@/lib/utils";

/** Renaming the site is these two strings. */
const NAME = "Esahist";
const TLD = ".ro";

/**
 * The piece's colours, sampled off the reference logo rather than picked. Two
 * tones and no gradient: a lit face and the side turned away from the light.
 *
 * Literals, not tokens. Everything else on the page follows the theme; a logo
 * must not. `--color-brand` is indigo under Midnight, and a mark that changes
 * colour with the wallpaper is not a mark.
 */
const FACE = "#4e9e36";
const SHADE = "#2e7a30";

/** The piece's own coordinates, in hundredths of an em. */
const PAWN_W = 108;
const PAWN_H = 165;

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
 * The piece.
 *
 * Symmetrical, drawn in four parts — foot, body, collar, head — each a lit shape
 * with its shaded side laid over it. Separate shapes rather than one clipped
 * overlay: a clip needs an id, an id has to be unique per instance, and that
 * would drag the whole component into the client for nothing.
 *
 * The shading meets the light down a curve rather than a straight vertical. A
 * straight edge reads as two colours side by side; a curved one reads as a round
 * thing lit from the left, which is the entire job at sixteen pixels.
 */
function PawnGlyph() {
	return (
		<>
			<path
				d="M 22 126 L 86 126 C 94 137 100 145 103 152 C 106 158 102 164 96 164 L 12 164 C 6 164 2 158 5 152 C 8 145 14 137 22 126 Z"
				fill={FACE}
			/>
			<path
				d="M 54 126 L 86 126 C 94 137 100 145 103 152 C 106 158 102 164 96 164 L 54 164 C 60 158 60 137 54 126 Z"
				fill={SHADE}
			/>

			<path
				d="M 40 70 C 38 89 32 110 22 128 L 86 128 C 76 110 70 89 68 70 Z"
				fill={FACE}
			/>
			<path
				d="M 54 70 L 68 70 C 70 89 76 110 86 128 L 54 128 C 57 110 57 89 54 70 Z"
				fill={SHADE}
			/>

			<rect fill={FACE} height="18" rx="9" width="62" x="23" y="55" />
			<path
				d="M 54 55 L 76 55 C 81 55 85 59 85 64 C 85 69 81 73 76 73 L 54 73 Z"
				fill={SHADE}
			/>

			<circle cx="54" cy="28" fill={FACE} r="28" />
			<path
				d="M 54 0 A 28 28 0 0 1 54 56 C 64 49 70 39 70 28 C 70 17 64 7 54 0 Z"
				fill={SHADE}
			/>
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
			viewBox={`0 0 ${PAWN_W} ${PAWN_H}`}
			xmlns="http://www.w3.org/2000/svg"
		>
			{/* Omitted, not just hidden, when the name is written beside it: an
			    aria-hidden title is still DOM text, and selecting the lockup would
			    copy the name twice. */}
			{!decorative && <title>{`${NAME}${TLD}`}</title>}
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
				{NAME}
				<span className="font-normal text-[0.63em]">{TLD}</span>
			</span>
		</span>
	);
}
