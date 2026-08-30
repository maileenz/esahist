import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import {
	LegalBullets,
	LegalDocument,
	LegalEmail,
	LegalSection,
} from "@/components/legal-prose";
import { formatLegalDate, PRIVACY_EMAIL } from "@/lib/legal";
import { canonical, openGraphFor, twitterFor } from "@/lib/seo";

const PATH = "/privacy-policy";

const UPDATED = "2026-08-29";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("privacyPolicy");
	const locale = await getLocale();
	const title = t("metaTitle");
	const description = t("metaDescription");

	return {
		title,
		description,
		alternates: canonical(PATH),
		openGraph: openGraphFor({
			description,
			locale,
			title,
			url: PATH,
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

	return (
		<LegalDocument
			path={PATH}
			title={t("title")}
			updated={t("updated", { date: formatLegalDate(UPDATED, locale) })}
		>
			<p className="mt-6 text-fg">{t("intro")}</p>
			<p className="mt-3 rounded-lg bg-elevated px-4 py-3 text-fg">
				{t("summary")}
			</p>

			<LegalSection title={t("collectTitle")}>
				<LegalBullets
					items={[
						t("collectSignIn"),
						t("collectProfile"),
						t("collectPlay"),
						t("collectReports"),
						t("collectBilling"),
						t("collectTechnical"),
					]}
				/>
			</LegalSection>

			<LegalSection title={t("whyTitle")}>
				<p>{t("whyBody")}</p>
			</LegalSection>

			{/*
			 * Called out rather than buried in a list. Everything else on this
			 * page is what a reader would assume; this is the part that is not,
			 * so it gets a border and its own colour.
			 */}
			<LegalSection title={t("publicTitle")}>
				<div className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3">
					<p className="text-fg">{t("publicBody")}</p>
					<p className="mt-2 text-fg">{t("publicNotShown")}</p>
				</div>
			</LegalSection>

			<LegalSection title={t("cookiesTitle")}>
				<LegalBullets
					items={[
						t("cookiesNecessary"),
						t("cookiesChoice"),
						t("cookiesAnalytics"),
					]}
				/>
			</LegalSection>

			<LegalSection title={t("sharingTitle")}>
				<p>{t("sharingBody")}</p>
				<LegalBullets
					items={[
						t("sharingAuth"),
						t("sharingStripe"),
						t("sharingUploads"),
						t("sharingHosting"),
					]}
				/>
				<p className="font-semibold text-fg">{t("sharingNever")}</p>
			</LegalSection>

			<LegalSection title={t("keepingTitle")}>
				<p>{t("keepingBody")}</p>
			</LegalSection>

			<LegalSection title={t("rightsTitle")}>
				<p>{t("rightsBody")}</p>
				<p>{t("rightsComplaint")}</p>
			</LegalSection>

			<LegalSection title={t("childrenTitle")}>
				<p>{t("childrenBody")}</p>
			</LegalSection>

			<LegalSection title={t("changesTitle")}>
				<p>{t("changesBody")}</p>
			</LegalSection>

			<LegalSection title={t("contactTitle")}>
				<p>{t("contactBody")}</p>
				<LegalEmail address={PRIVACY_EMAIL} />
			</LegalSection>

			{/* The two documents are read together, so each one ends by pointing
				    at the other. */}
			<LegalSection title={t("termsTitle")}>
				<p>{t("termsBody")}</p>
				<Link
					className="font-semibold text-primary hover:underline"
					href="/terms-of-service"
				>
					{t("termsLink")}
				</Link>
			</LegalSection>
		</LegalDocument>
	);
}
