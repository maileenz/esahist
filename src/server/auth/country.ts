import { headers } from "next/headers";

import { countryFromLocale, isCountryCode } from "@/lib/countries";

/**
 * Headers a hosting platform sets from its own GeoIP lookup. Nothing sets them
 * locally, and no provider sends a country of its own, so this is best-effort
 * by design — the member can always correct it on their profile.
 */
const GEO_HEADERS = [
	"x-vercel-ip-country", // Vercel
	"cf-ipcountry", // Cloudflare
	"x-geo-country", // common reverse-proxy convention
	"fastly-client-country-code",
];

async function countryFromRequest(): Promise<string | null> {
	try {
		const inbound = await headers();
		for (const name of GEO_HEADERS) {
			const value = inbound.get(name);
			// Cloudflare sends "XX" for anonymised or unknown clients.
			if (value && value !== "XX" && isCountryCode(value)) {
				return value.toUpperCase();
			}
		}
	} catch {
		// `headers()` is only callable inside a request scope; outside one this
		// simply means we have no hint.
	}
	return null;
}

/**
 * Guess a country while signing in. The request's own geo header wins over a
 * language setting, since `en-US` is a common choice far outside the US.
 */
export async function guessCountry(
	locale?: string | null,
): Promise<string | null> {
	return (await countryFromRequest()) ?? countryFromLocale(locale);
}
