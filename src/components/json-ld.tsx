/**
 * Structured data, in the one form search engines read it.
 *
 * A `<script>` tag rather than anything in `generateMetadata`, because Next's
 * Metadata API has no field for JSON-LD — this is the documented way to do it.
 * The type is `application/ld+json`, so no browser executes it; it is inert
 * text that a crawler picks out of the document.
 *
 * `JSON.stringify` on an object we built ourselves, never on anything a member
 * typed. A `</script>` inside a string would close the tag early and turn the
 * rest of the page into markup — which is why nothing user-supplied is passed
 * here, and why this takes a structure rather than a string.
 */
export default function JsonLd({ data }: { data: object }) {
	return (
		<script
			// biome-ignore lint/security/noDangerouslySetInnerHtml: the only way to emit a JSON-LD block, and the payload is built in `@/lib/seo`, never from user input
			dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
			type="application/ld+json"
		/>
	);
}
