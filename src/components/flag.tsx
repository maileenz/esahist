import { countryName, isCountryCode } from "@/lib/countries";
import { cn } from "@/lib/utils";

/**
 * SVG flag from `flag-icons` rather than a regional-indicator emoji: Windows
 * ships no flag glyphs in Segoe UI Emoji, so 🇷🇴 renders there as the letters
 * "RO". The CSS is imported once in the root layout and each flag is a
 * background image, so only the ones actually on screen get fetched.
 *
 * `.fi` sizes itself in `em` — `1.333em` wide by `1em` tall — so a flag with no
 * size of its own is as big as whatever text it happens to sit in. Dropped into
 * a `text-2xl` heading that is a 32px flag beside a name. Hence the default
 * below: flags are small metadata everywhere they appear, and a caller that
 * wants a different size says so with a `text-*` class, which `cn` will let win
 * over this one.
 */
export default function Flag({
	code,
	className = "",
	square = false,
}: {
	code: string | null | undefined;
	className?: string;
	/** 1:1 instead of the default 4:3. */
	square?: boolean;
}) {
	if (!isCountryCode(code)) return null;

	const name = countryName(code);
	return (
		<span
			aria-label={name}
			className={cn(
				"text-sm leading-none",
				`fi fi-${code.toLowerCase()}`,
				square && "fis",
				className,
			)}
			role="img"
			title={name}
		/>
	);
}
