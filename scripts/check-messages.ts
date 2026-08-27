/**
 * Checks every catalogue against English.
 *
 * English is the reference: `src/types/next-intl.d.ts` types `t()` against it,
 * so a key missing there is already a compile error. What the compiler cannot
 * see is the *other* catalogues — a missing Romanian key is not a build failure,
 * it is an English word appearing mid-sentence on a Romanian page, and nobody
 * notices until a reader does.
 *
 * Run it in CI:
 *
 *   pnpm check:messages
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { DEFAULT_LOCALE, LOCALES } from "../src/i18n/locales";

type Catalogue = { [key: string]: string | Catalogue };

const MESSAGES = join(process.cwd(), "messages");

function read(locale: string): Catalogue {
	return JSON.parse(
		readFileSync(join(MESSAGES, `${locale}.json`), "utf8"),
	) as Catalogue;
}

/** Every leaf, as dotted paths — `nav.play`, `consent.categories.analytics.title`. */
function paths(node: Catalogue, prefix = ""): string[] {
	return Object.entries(node).flatMap(([key, value]) => {
		const path = prefix ? `${prefix}.${key}` : key;
		return typeof value === "string" ? [path] : paths(value, path);
	});
}

/** `{count}`, `{query}` — a placeholder the other language has to keep. */
function placeholders(value: string): string[] {
	return [...value.matchAll(/\{(\w+)/g)].map((match) => match[1] ?? "").sort();
}

function at(node: Catalogue, path: string): string | undefined {
	const value = path
		.split(".")
		.reduce<string | Catalogue | undefined>(
			(current, key) =>
				typeof current === "object" ? current[key] : undefined,
			node,
		);
	return typeof value === "string" ? value : undefined;
}

const reference = read(DEFAULT_LOCALE);
const expected = paths(reference);
let failed = false;

for (const locale of LOCALES) {
	if (locale === DEFAULT_LOCALE) continue;

	const catalogue = read(locale);
	const actual = new Set(paths(catalogue));

	const missing = expected.filter((path) => !actual.has(path));
	const extra = [...actual].filter((path) => !expected.includes(path));

	// A placeholder that does not survive translation is worse than a missing
	// key: the sentence renders, with a hole where the number should be.
	const mismatched = expected
		.filter((path) => actual.has(path))
		.filter((path) => {
			const from = placeholders(at(reference, path) ?? "");
			const to = placeholders(at(catalogue, path) ?? "");
			return from.join() !== to.join();
		});

	if (missing.length || extra.length || mismatched.length) {
		failed = true;
		console.error(`\n${locale}.json`);
		for (const path of missing) console.error(`  missing      ${path}`);
		for (const path of extra) console.error(`  not in en    ${path}`);
		for (const path of mismatched) {
			console.error(
				`  placeholders ${path}: en has {${placeholders(at(reference, path) ?? "").join("}, {")}}`,
			);
		}
	} else {
		console.log(`${locale}.json — ${expected.length} keys, all present`);
	}
}

if (failed) process.exit(1);
