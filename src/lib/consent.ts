/**
 * What the visitor has agreed to, and where that answer is kept.
 *
 * The answer lives in `localStorage` rather than a cookie on purpose: a cookie
 * would be sent up with every request, which means asking about storage by
 * using the very thing being asked about. Nothing here needs to reach the
 * server — the decision only ever gates what the *browser* is allowed to load.
 *
 * Every read goes through `readConsent`, and every read is wrapped: Safari in
 * private mode throws on `localStorage`, an embedded context can have storage
 * blocked outright, and the stored string is user-writable and therefore not to
 * be trusted. A throw or a value that does not parse is treated as "not asked
 * yet", which fails to the side of collecting nothing.
 */

/** Namespaced, because `localStorage` is one flat shelf per origin. */
export const CONSENT_KEY = "grand-master.consent";

/**
 * Bump when the categories change.
 *
 * A stored answer from an older version is discarded and the banner comes back:
 * agreeing to the two categories that existed in v1 is not agreement to a third
 * one added later, and treating it as such is the thing the law is actually
 * about.
 */
export const CONSENT_VERSION = 1;

/** Fired on the window whenever a decision is recorded or withdrawn. */
export const CONSENT_EVENT = "grand-master:consent";

/** Fired to ask the banner to open its preferences dialog. */
export const CONSENT_OPEN_EVENT = "grand-master:consent-open";

/**
 * The optional categories.
 *
 * Strictly necessary storage is deliberately absent: the session cookie, the
 * CSRF token and the reconnection token are what "use the site" means, they
 * cannot be switched off, and offering a switch that does nothing is worse than
 * offering none.
 */
export interface Consent {
	version: number;
	/** Aggregate usage measurement. Nothing is wired to it yet. */
	analytics: boolean;
	/** When they answered, so a stale decision can be spotted later. */
	decidedAt: string;
}

/**
 * Which categories exist, and which of them cannot be switched off.
 *
 * The words live in the message catalogue under `consent.categories`, keyed by
 * these ids: two places ask the question — the banner on first visit and the
 * privacy settings afterwards — and a description that drifts between them is a
 * description that is wrong in one of them.
 */
export interface ConsentCategory {
	id: "necessary" | "analytics";
	/** Always on. The switch is shown, and cannot move. */
	locked: boolean;
}

export const CONSENT_CATEGORIES: ConsentCategory[] = [
	{ id: "necessary", locked: true },
	{ id: "analytics", locked: false },
];

export function readConsent(): Consent | null {
	if (typeof window === "undefined") return null;

	let raw: string | null;
	try {
		raw = window.localStorage.getItem(CONSENT_KEY);
	} catch {
		// Storage is blocked. Nothing was ever stored, so nothing was consented
		// to — and we cannot record an answer either, so the banner will ask
		// again. That is the honest outcome, if an annoying one.
		return null;
	}

	if (!raw) return null;

	try {
		const parsed: unknown = JSON.parse(raw);
		if (typeof parsed !== "object" || parsed === null) return null;

		const value = parsed as Partial<Consent>;
		if (value.version !== CONSENT_VERSION) return null;

		return {
			version: CONSENT_VERSION,
			// Anything other than a literal `true` is a no. A truthy-ish value in
			// a hand-edited string must not read as agreement.
			analytics: value.analytics === true,
			decidedAt:
				typeof value.decidedAt === "string"
					? value.decidedAt
					: new Date().toISOString(),
		};
	} catch {
		return null;
	}
}

export function writeConsent(choice: { analytics: boolean }): Consent {
	const consent: Consent = {
		version: CONSENT_VERSION,
		analytics: choice.analytics,
		decidedAt: new Date().toISOString(),
	};

	try {
		window.localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
	} catch {
		// Nothing to do but carry on: the banner closes for this visit and comes
		// back on the next one, which is the safe way round.
	}

	window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: consent }));
	return consent;
}

/** Withdrawing. The banner returns, and anything gated goes back to off. */
export function forgetConsent(): void {
	try {
		window.localStorage.removeItem(CONSENT_KEY);
	} catch {
		// Already unreachable; there is nothing stored to remove.
	}

	window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: null }));
}

/**
 * The one call anything gated should make.
 *
 * Returns false when they have not answered yet, so a script that asks this
 * question before the banner has been dealt with stays off — consent is
 * something given, never something assumed from silence.
 */
export function hasConsent(category: "analytics"): boolean {
	return readConsent()?.[category] === true;
}

/** Reopens the preferences dialog from anywhere on the page. */
export function openConsentPreferences(): void {
	window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
}
