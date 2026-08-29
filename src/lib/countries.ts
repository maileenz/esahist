/**
 * ISO 3166-1 alpha-2. Only the code is ever stored; this file is what turns one
 * into something a person can read, in whichever language they are reading.
 *
 * The names are a generated table rather than a live `Intl.DisplayNames`, which
 * is the obvious thing to reach for and is wrong here: the display names come
 * from whichever CLDR version the *runtime* was built against, so Node and the
 * browser disagree — measured, on this pair, for FK, HK, MO and PS. Any country
 * name rendered by a client component would therefore be a hydration mismatch
 * waiting for somebody from Hong Kong to sign up. A table is boring and
 * identical everywhere, which is the entire requirement.
 *
 * Every locale is generated together, from one Node, by
 * `scripts/generate-country-names.ts` — so a second language costs nothing to
 * maintain and cannot drift from the first.
 */

import { type AppLocale, DEFAULT_LOCALE } from "@/i18n/locales";

import { COUNTRY_CODES, COUNTRY_NAMES } from "./country-names";

const CODE_SET = new Set(COUNTRY_CODES);

export function isCountryCode(value: unknown): value is string {
	return typeof value === "string" && CODE_SET.has(value.toUpperCase());
}

/**
 * A URL or form value narrowed to a country, or null. Case-insensitive,
 * because `?country=ro` is what somebody types.
 */
export function toCountryCode(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const code = value.trim().toUpperCase();
	return isCountryCode(code) ? code : null;
}

/**
 * Unpacked on first use and kept, rather than at module load: a page that
 * renders one flag pays for one locale, not for every language the site
 * offers.
 */
const byLocale = new Map<AppLocale, Map<string, string>>();

function namesFor(locale: AppLocale): Map<string, string> {
	const cached = byLocale.get(locale);
	if (cached) return cached;

	const packed = COUNTRY_NAMES[locale] ?? COUNTRY_NAMES[DEFAULT_LOCALE];
	const names = new Map(
		packed.split("|").map((pair) => {
			const [code, name] = pair.split("=");
			return [code as string, name as string];
		}),
	);

	byLocale.set(locale, names);
	return names;
}

/**
 * "RO" → "Romania", or "România" in Romanian. Falls back to the code for
 * anything unlisted.
 *
 * The locale is a parameter rather than something read from context, so this
 * stays a plain function usable from anywhere — a server component, a client
 * component, or the Colyseus process, which has no React around it at all.
 */
export function countryName(
	code: string,
	locale: AppLocale = DEFAULT_LOCALE,
): string {
	const upper = code.toUpperCase();
	return namesFor(locale).get(upper) ?? upper;
}

/**
 * Flags are rendered by `<Flag>` from the `flag-icons` SVGs, not from
 * regional-indicator emoji: Windows has no flag glyphs, so the emoji form shows
 * up there as the bare letters "RO".
 */

/**
 * Sorted for a picker: name order, not code order, and in the reader's own
 * collation — Romanian sorts "Ț" after "T" rather than after "Z", which is
 * where a plain byte comparison would put it.
 */
export function countryOptions(
	locale: AppLocale = DEFAULT_LOCALE,
): { code: string; name: string }[] {
	return COUNTRY_CODES.map((code) => ({
		code,
		name: countryName(code, locale),
	})).sort((a, b) => a.name.localeCompare(b.name, locale));
}

/**
 * A locale is not a country, but when it carries a region subtag it is the best
 * hint an OAuth profile gives us: `pt-BR` → BR, `en-US` → US, plain `ro` → null.
 */
export function countryFromLocale(
	locale: string | null | undefined,
): string | null {
	if (!locale) return null;
	const region = locale.replace("_", "-").split("-")[1]?.toUpperCase();
	return region && CODE_SET.has(region) ? region : null;
}
