import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import JsonLd from "@/components/json-ld";
import {
	breadcrumbs,
	canonical,
	openGraphFor,
	SITE_NAME,
	twitterFor,
} from "@/lib/seo";

/**
 * Where to write about anything on this page.
 *
 * A constant rather than prose in the catalogue, because it is the same address
 * in every language and because it has to be changed in exactly one place. It
 * is on the site's own domain deliberately: an OAuth provider reviewing the app
 * will check that the policy is reachable and that this address belongs to the
 * same operator.
 *
 * **This mailbox has to exist.** A privacy policy naming an address that
 * bounces is worse than one with no address at all — under the GDPR it is the
 * route for access and erasure requests, and there is a deadline on answering
 * them.
 */
const CONTACT_EMAIL = "privacy@esahist.ro";

/**
 * When this text last changed.
 *
 * Written here rather than generated from the file's date: "last updated" means
 * the day the wording changed, and a build date would silently claim a review
 * that never happened. Change it when you change the words.
 */
const UPDATED = "2026-08-29";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("privacyPolicy");
	const locale = await getLocale();
	const title = t("metaTitle");
	const description = t("metaDescription");

	return {
		title,
		description,
		alternates: canonical("/privacy-policy"),
		openGraph: openGraphFor({
			description,
			locale,
			title,
			url: "/privacy-policy",
		}),
		twitter: twitterFor({ description, title }),
		// Explicitly indexable. Facebook, and every other provider that reviews an
		// app, requires this page to be reachable by their crawler — a `noindex`
		// inherited from somewhere would fail that review without saying why.
		robots: { index: true, follow: true },
	};
}

/**
 * The privacy policy, at a public address that never needs a session.
 *
 * It exists because sign-in providers require one: Facebook will not review an
 * app without a policy URL that its crawler can fetch. But the reason it is
 * worth writing properly is the site itself — profiles, games and leaderboards
 * are public and indexed, which is the single most surprising thing about this
 * site to somebody who has just signed up, and it deserves to be stated plainly
 * rather than discovered.
 *
 * The words live in the message catalogue like everything else, so the policy is
 * read in the reader's own language. That matters here more than elsewhere:
 * consent to something you cannot read is not consent.
 */
export default async function PrivacyPolicyPage() {
	const t = await getTranslations("privacyPolicy");
	const locale = await getLocale();

	// The reader's own date order, the same way finished games are dated.
	const updated = new Date(UPDATED).toLocaleDateString(locale, {
		day: "numeric",
		month: "long",
		year: "numeric",
	});

	return (
		<main className="mx-auto w-full max-w-3xl p-4">
			<JsonLd
				data={breadcrumbs([
					{ name: SITE_NAME, path: "/" },
					{ name: t("title"), path: "/privacy-policy" },
				])}
			/>

			<article className="rounded-xl border border-line bg-surface p-6 shadow-sm sm:p-8">
				<h1 className="font-bold text-2xl text-fg">{t("title")}</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					{t("updated", { date: updated })}
				</p>

				<p className="mt-6 text-fg">{t("intro")}</p>
				<p className="mt-3 rounded-lg bg-elevated px-4 py-3 text-fg">
					{t("summary")}
				</p>

				<Section title={t("collectTitle")}>
					<Bullets
						items={[
							t("collectSignIn"),
							t("collectProfile"),
							t("collectPlay"),
							t("collectReports"),
							t("collectBilling"),
							t("collectTechnical"),
						]}
					/>
				</Section>

				<Section title={t("whyTitle")}>
					<p>{t("whyBody")}</p>
				</Section>

				{/*
				 * Called out rather than buried in a list. Everything else on this
				 * page is what a reader would assume; this is the part that is not,
				 * so it gets a border and its own colour.
				 */}
				<Section title={t("publicTitle")}>
					<div className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3">
						<p className="text-fg">{t("publicBody")}</p>
						<p className="mt-2 text-fg">{t("publicNotShown")}</p>
					</div>
				</Section>

				<Section title={t("cookiesTitle")}>
					<Bullets
						items={[
							t("cookiesNecessary"),
							t("cookiesChoice"),
							t("cookiesAnalytics"),
						]}
					/>
				</Section>

				<Section title={t("sharingTitle")}>
					<p>{t("sharingBody")}</p>
					<Bullets
						items={[
							t("sharingAuth"),
							t("sharingStripe"),
							t("sharingUploads"),
							t("sharingHosting"),
						]}
					/>
					<p className="font-semibold text-fg">{t("sharingNever")}</p>
				</Section>

				<Section title={t("keepingTitle")}>
					<p>{t("keepingBody")}</p>
				</Section>

				<Section title={t("rightsTitle")}>
					<p>{t("rightsBody")}</p>
					<p>{t("rightsComplaint")}</p>
				</Section>

				<Section title={t("childrenTitle")}>
					<p>{t("childrenBody")}</p>
				</Section>

				<Section title={t("changesTitle")}>
					<p>{t("changesBody")}</p>
				</Section>

				<Section title={t("contactTitle")}>
					<p>{t("contactBody")}</p>
					{/*
					 * The address is a link rather than a placeholder inside the
					 * sentence: next-intl's `t.rich` needs a tag to hang a component
					 * on, and passing a render function to a plain `{email}` slot is a
					 * function crossing into a client component — which is a 500, not a
					 * fallback. One element, one source of truth for the address.
					 */}
					<a
						className="font-semibold text-primary hover:underline"
						href={`mailto:${CONTACT_EMAIL}`}
					>
						{CONTACT_EMAIL}
					</a>
				</Section>
			</article>
		</main>
	);
}

/** One numbered part of the document: a heading and whatever sits under it. */
function Section({
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
 * The text is the identity here: these are fixed paragraphs from the catalogue,
 * not a reorderable collection, so nothing can collide and nothing moves.
 */
function Bullets({ items }: { items: string[] }) {
	return (
		<ul className="flex list-disc flex-col gap-2 pl-5">
			{items.map((item) => (
				<li key={item}>{item}</li>
			))}
		</ul>
	);
}
