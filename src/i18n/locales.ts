/**
 * The languages this site speaks, and the one it falls back to.
 *
 * Kept away from `request.ts` so a client component can import the list — the
 * language picker needs it — without dragging `next/headers` into the browser
 * bundle.
 */

export const LOCALES = ["en", "ro"] as const;

export type AppLocale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "en";

/**
 * In the language itself, never translated. A reader looking for their own
 * language is looking for the word they would use for it, not for "Romanian"
 * rendered in a language they cannot read.
 */
export const LOCALE_LABELS: Record<AppLocale, string> = {
	en: "English",
	ro: "Română",
};

/** Where the choice is stored. Read on the server, written by the picker. */
export const LOCALE_COOKIE = "locale";

/** A year: long enough that a returning reader is never asked twice. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is AppLocale {
	return typeof value === "string" && LOCALES.includes(value as AppLocale);
}

/**
 * The best of what the browser asked for.
 *
 * `Accept-Language` is a weighted list — `ro-RO,ro;q=0.9,en;q=0.8` — so it is
 * sorted by weight and the first supported language wins. The region is dropped
 * before matching: somebody asking for `ro-MD` wants Romanian.
 */
export function negotiateLocale(acceptLanguage: string | null): AppLocale {
	if (!acceptLanguage) return DEFAULT_LOCALE;

	const ranked = acceptLanguage
		.split(",")
		.map((part) => {
			const [tag, ...params] = part.trim().split(";");
			const quality = params
				.map((param) => param.trim())
				.find((param) => param.startsWith("q="));
			return {
				language: (tag ?? "").trim().toLowerCase().split("-")[0] ?? "",
				// A tag without an explicit weight is the most preferred one.
				quality: quality ? Number(quality.slice(2)) : 1,
			};
		})
		.filter((entry) => entry.language !== "" && Number.isFinite(entry.quality))
		.sort((a, b) => b.quality - a.quality);

	// A loop rather than `find`, because narrowing inside a predicate does not
	// survive to the result: `find` would hand back a plain string.
	for (const entry of ranked) {
		if (isLocale(entry.language)) return entry.language;
	}
	return DEFAULT_LOCALE;
}
