"use server";

import { cookies } from "next/headers";

import {
	type AppLocale,
	isLocale,
	LOCALE_COOKIE,
	LOCALE_COOKIE_MAX_AGE,
} from "./locales";

/**
 * Switches the language for this browser.
 *
 * A server action rather than a client-side cookie write, because the pages are
 * rendered on the server: the value has to be readable by the *next* request,
 * and only the server can set a cookie the reader cannot tamper with in the
 * meantime. The caller refreshes afterwards to re-render in the new language.
 *
 * The argument is validated even though it is typed. A server action is a
 * public endpoint — the type disappears at the network boundary, and this one
 * ends up as a filename in `request.ts`.
 */
export async function setLocale(locale: AppLocale): Promise<void> {
	if (!isLocale(locale)) return;

	const store = await cookies();
	store.set(LOCALE_COOKIE, locale, {
		httpOnly: false,
		maxAge: LOCALE_COOKIE_MAX_AGE,
		path: "/",
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
	});
}
