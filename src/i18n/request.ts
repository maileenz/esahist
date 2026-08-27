import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import {
	type AppLocale,
	isLocale,
	LOCALE_COOKIE,
	negotiateLocale,
} from "./locales";

/**
 * Which language to render in, and the words to render it with.
 *
 * The choice is a cookie rather than a URL segment, so every route keeps the
 * one address it already had and a shared link opens in the reader's own
 * language rather than the sender's.
 *
 * The cookie is validated rather than trusted: it is user-writable, and an
 * unchecked value would reach the dynamic import below as a filename. Anything
 * unrecognised falls through to what the browser asked for, and only then to
 * English — so a first visit from a Romanian browser is already in Romanian.
 */
export default getRequestConfig(async () => {
	const store = await cookies();
	const chosen = store.get(LOCALE_COOKIE)?.value;

	const locale: AppLocale = isLocale(chosen)
		? chosen
		: negotiateLocale((await headers()).get("accept-language"));

	return {
		locale,
		messages: (await import(`../../messages/${locale}.json`)).default,
	};
});
