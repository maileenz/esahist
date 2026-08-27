import { flairById } from "@/lib/flairs";
import { cn } from "@/lib/utils";

/**
 * The emoji a member wears beside their handle.
 *
 * Renders nothing at all for "none" and for an id the catalogue no longer
 * knows, so retiring a flair quietly removes it from every profile instead of
 * leaving a tofu box behind. The name is the accessible label — a bare emoji
 * announces as whatever the screen reader's own table calls it, which for
 * `♟️` is not "pawn".
 *
 * Sized like `Flag`, and for the same reason: an emoji with no size of its own
 * is as big as the text around it, which in a `text-2xl` heading is a 24px
 * emoji beside a 14px flag. The two are a pair and should stay one size, so
 * both default to the same and both let a `text-*` class override it.
 */
export default function Flair({
	id,
	className = "",
}: {
	id: string | null | undefined;
	className?: string;
}) {
	const flair = flairById(id);
	if (!flair) return null;

	return (
		<span
			aria-label={flair.name}
			className={cn("shrink-0 text-sm leading-none", className)}
			role="img"
			title={flair.name}
		>
			{flair.emoji}
		</span>
	);
}
