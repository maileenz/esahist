/**
 * The facts the legal pages share.
 *
 * Both documents name an address and carry a date, and both had the same two
 * ways of getting those wrong: a mailbox that differs between pages, and a date
 * that reads back as a different day than the one written in the source. They
 * are settled here once.
 */

/**
 * Where privacy and data requests go.
 *
 * **This mailbox has to exist.** Under the GDPR it is the route for access and
 * erasure requests, and there is a deadline on answering them — a policy naming
 * an address that bounces is worse than one with no address at all.
 */
export const PRIVACY_EMAIL = "privacy@esahist.ro";

/**
 * Where everything else goes: questions about the terms, and appeals against a
 * suspension. **This one has to exist too** — the terms promise a person will
 * look at an appeal again, and that promise is only as good as the inbox.
 *
 * A second address rather than reusing the privacy one so that a data request
 * and a complaint about a lost game do not land in the same queue; both can be
 * aliases of one inbox if that is easier.
 */
export const SUPPORT_EMAIL = "support@esahist.ro";

/**
 * A date written in the source, read back as the same calendar day.
 *
 * Pinned to UTC deliberately. A date-only ISO string parses as UTC midnight,
 * and formatting it in the server's own zone renders the day before anywhere
 * west of UTC — so a container in a US region would quietly claim a legal
 * document was last updated a day earlier than it was.
 *
 * This is the opposite of what a finished game wants, where `startedAt` is a
 * real instant and should be shown in local terms. A calendar day is not an
 * instant.
 */
export function formatLegalDate(iso: string, locale: string): string {
	return new Date(iso).toLocaleDateString(locale, {
		day: "numeric",
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	});
}
