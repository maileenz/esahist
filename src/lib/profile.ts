import { z } from "zod";

import { isCountryCode } from "@/lib/countries";
import { isFlairId } from "@/lib/flairs";

/**
 * What a member is allowed to say about themselves, and how long they get to
 * say it.
 *
 * These schemas are deliberately not in the router: the form resolves against
 * exactly the same object the procedure validates, so the counter under the
 * textarea and the check that protects the column can never drift apart. Empty
 * strings are the form's way of spelling "nothing" — the server is what turns
 * them into NULL.
 */

/** Matches the `status` column. Changing one without the other truncates. */
export const STATUS_MAX = 50;
export const NAME_MAX = 50;
export const LOCATION_MAX = 64;

export const publicProfileInput = z.object({
	status: z
		.string()
		.trim()
		.max(STATUS_MAX, `Keep it to ${STATUS_MAX} characters.`),
});

export const flairInput = z.object({
	/** `null` is "no flair", which is a choice and not a missing value. */
	flair: z
		.string()
		.nullable()
		.refine((value) => value === null || isFlairId(value), "Unknown flair"),
});

export const detailsInput = z.object({
	name: z.string().trim().max(NAME_MAX, `Keep it to ${NAME_MAX} characters.`),
	location: z
		.string()
		.trim()
		.max(LOCATION_MAX, `Keep it to ${LOCATION_MAX} characters.`),
	/** `""` clears the flag; anything else has to be a real ISO code. */
	country: z
		.string()
		.refine(
			(value) => value === "" || isCountryCode(value),
			"Not a country we know",
		),
});

export type PublicProfileInput = z.infer<typeof publicProfileInput>;
export type FlairInput = z.infer<typeof flairInput>;
export type DetailsInput = z.infer<typeof detailsInput>;

/** Trimmed-empty is stored as NULL, so "" and "   " never become a value. */
export function orNull(value: string): string | null {
	const trimmed = value.trim();
	return trimmed === "" ? null : trimmed;
}
