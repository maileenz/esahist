import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * The initial, sized against the avatar rather than against the page.
 *
 * The primitive hard-codes `text-sm` on the fallback, which is right for the
 * 32px default it was written for and wrong everywhere else: the same 14px
 * letter sat in a 128px profile avatar and in a 16px one in a game row. `cqw`
 * is a percentage of the container's own width — the root opts into being that
 * container — so the letter is always the same fraction of whatever box it is
 * in, including sizes nobody has used yet.
 *
 * 42% is roughly what the primitive's own default works out to (14 of 32), so
 * every existing avatar keeps the proportion it was designed with. `max()` puts
 * a floor under it: 42% of a 16px tile is a 7px letter, which is not reading
 * material at any size.
 */
const FALLBACK_SIZE = "text-[max(9px,42cqw)]";

/**
 * A member's picture, wherever one appears.
 *
 * There were seven copies of this, each a bare `<img>` with a letter tile
 * beside it for the null case — which handles "no avatar" and not "an avatar
 * that fails to load". A provider CDN that 404s somebody's picture, or an
 * upload deleted out from under us, rendered a broken-image glyph. Radix swaps
 * in the fallback on the image's error event, so the initial appears either way.
 *
 * Corners are set once, by whatever `className` the caller gives the root. The
 * primitive rounds the root, the image, the fallback and its hairline ::after
 * separately, and defaults all four to a circle — so asking for `rounded-md`
 * got you a round photo inside a squared-off frame. These inherit instead:
 * there is one radius, and it is the one that was passed in.
 */
export default function MemberAvatar({
	name,
	image,
	className,
	fallbackClassName,
	fallback,
	children,
}: {
	/** Display name or handle — only its first letter is used. */
	name: string;
	image: string | null | undefined;
	/** Size, and the corner radius everything inside follows. */
	className?: string;
	/**
	 * For the rare avatar whose initial should not be 42% of it — a `text-*`
	 * here beats the automatic size.
	 */
	fallbackClassName?: string;
	/** Shown instead of the initial — an icon, for a seat nobody is in yet. */
	fallback?: React.ReactNode;
	/** An `AvatarBadge`, for the presence dot on the board. */
	children?: React.ReactNode;
}) {
	return (
		// `@container` is what makes `cqw` on the fallback mean "of this avatar".
		<Avatar className={cn("@container after:rounded-[inherit]", className)}>
			<AvatarImage
				alt=""
				className="rounded-[inherit]"
				src={image ?? undefined}
			/>
			{/*
			 * Radix shows the fallback until the image's load event, which made a
			 * cached avatar flash its initial for a frame. Waiting fixes that —
			 * but only when there is an image on the way. Most members have none,
			 * and delaying their initial would trade one flash for a blank hole.
			 */}
			<AvatarFallback
				className={cn(
					"rounded-[inherit] font-semibold",
					FALLBACK_SIZE,
					fallbackClassName,
				)}
				delayMs={image ? 300 : undefined}
			>
				{fallback ?? name.slice(0, 1).toUpperCase()}
			</AvatarFallback>
			{children}
		</Avatar>
	);
}
