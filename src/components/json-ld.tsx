/**
 * Structured data, in the one form search engines read it.
 *
 * A `<script>` tag rather than anything in `generateMetadata`, because Next's
 * Metadata API has no field for JSON-LD — this is the documented way to do it.
 * The type is `application/ld+json`, so no browser executes it; it is inert
 * text that a crawler picks out of the document.
 */

/**
 * JSON, made safe to sit inside a `<script>` element.
 *
 * `JSON.stringify` is not an HTML escaper. A forward slash means nothing in
 * JSON, so a string containing `</script>` is serialised verbatim — and the
 * HTML tokeniser ends a script element at the first `</script` it sees,
 * whatever the element's `type` says. Everything after it is then parsed as
 * markup.
 *
 * That is a real path here, not a hypothetical: a member's display name and
 * location are free text capped only by length, and both are published in the
 * `ProfilePage` block on a page anyone can now load. A name of
 * `</script><script>…</script>` fits inside the fifty-character limit.
 *
 * `<` is a legal JSON escape for `<`, so the payload a crawler parses is
 * unchanged — only the bytes the HTML tokeniser sees are. Escaping every `<`
 * rather than matching `</script>` is deliberate: it cannot be defeated by
 * casing, by `</script>`, or by whatever the next parser quirk turns out
 * to be.
 *
 * Done here, at the one place JSON reaches the DOM, rather than at each
 * caller. A guard every caller has to remember is a guard that will be
 * forgotten — this component previously carried a comment promising the
 * payload was never user input, which was true when it was written and stopped
 * being true the day profiles were added.
 */
function safeJson(data: object): string {
	return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default function JsonLd({ data }: { data: object }) {
	return (
		<script
			// biome-ignore lint/security/noDangerouslySetInnerHtml: the only way to emit a JSON-LD block. `safeJson` escapes every `<` first, which is what makes it safe — not any assumption about where the payload came from.
			dangerouslySetInnerHTML={{ __html: safeJson(data) }}
			type="application/ld+json"
		/>
	);
}
