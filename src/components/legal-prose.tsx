import JsonLd from "@/components/json-ld";
import { breadcrumbs, SITE_NAME } from "@/lib/seo";

/**
 * The shell both legal documents sit in.
 *
 * A shared shell rather than two pages that happen to look alike: the privacy
 * policy and the terms are read the same way, and the day one of them grows a
 * table of contents or a wider column the other should too. It also means the
 * breadcrumbs and the single `h1` are decided once rather than remembered
 * twice.
 */
export function LegalDocument({
	title,
	updated,
	path,
	children,
}: {
	title: string;
	/** Already formatted — see `formatLegalDate`. */
	updated: string;
	/** Site-relative, for the breadcrumb trail. */
	path: string;
	children: React.ReactNode;
}) {
	return (
		<main className="mx-auto w-full max-w-4xl p-4">
			<JsonLd
				data={breadcrumbs([
					{ name: SITE_NAME, path: "/" },
					{ name: title, path },
				])}
			/>

			<article className="rounded-xl border border-line bg-surface p-6 shadow-sm sm:p-8">
				<h1 className="font-bold text-2xl text-fg">{title}</h1>
				<p className="mt-1 text-muted-foreground text-sm">{updated}</p>

				{children}
			</article>
		</main>
	);
}

/** One part of the document: a heading and whatever sits under it. */
export function LegalSection({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<section className="mt-8">
			<h2 className="font-bold text-fg text-lg">{title}</h2>
			<div className="mt-2 flex flex-col gap-3 text-muted-foreground">
				{children}
			</div>
		</section>
	);
}

/**
 * A list of points, keyed by their own text.
 *
 * The text is the identity here: these are fixed paragraphs from the message
 * catalogue, not a reorderable collection, so nothing can collide and nothing
 * moves.
 */
export function LegalBullets({ items }: { items: string[] }) {
	return (
		<ul className="flex list-disc flex-col gap-2 pl-5">
			{items.map((item) => (
				<li key={item}>{item}</li>
			))}
		</ul>
	);
}

/**
 * An address to write to.
 *
 * A link rather than a placeholder inside a sentence: next-intl's `t.rich`
 * needs a tag to hang a component on, and passing a render function to a plain
 * `{email}` slot is a function crossing into a client component — which is a
 * 500, not a fallback.
 */
export function LegalEmail({ address }: { address: string }) {
	return (
		<a
			className="font-semibold text-primary hover:underline"
			href={`mailto:${address}`}
		>
			{address}
		</a>
	);
}
