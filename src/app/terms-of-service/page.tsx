import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import {
	LegalBullets,
	LegalDocument,
	LegalEmail,
	LegalSection,
} from "@/components/legal-prose";
import { formatLegalDate, SUPPORT_EMAIL } from "@/lib/legal";
import { canonical, openGraphFor, twitterFor } from "@/lib/seo";

const PATH = "/terms-of-service";

/**
 * When this text last changed.
 *
 * Written here rather than generated from the file's date: "last updated" means
 * the day the wording changed, and a build date would silently claim a review
 * that never happened. Change it when you change the words.
 */
const UPDATED = "2026-08-30";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("terms");
	const locale = await getLocale();
	const title = t("metaTitle");
	const description = t("metaDescription");

	return {
		title,
		description,
		alternates: canonical(PATH),
		openGraph: openGraphFor({ description, locale, title, url: PATH }),
		twitter: twitterFor({ description, title }),
		// Explicitly indexable. Google and Facebook both check that the terms URL
		// on an OAuth consent screen is reachable by their crawler; a `noindex`
		// inherited from somewhere would fail that review without saying why.
		robots: { index: true, follow: true },
	};
}

/**
 * The terms of service, at a public address that never needs a session.
 *
 * It exists because OAuth providers require one — Google's consent screen asks
 * for a terms URL alongside the privacy policy, and both have to be fetchable
 * by their crawler before an app is verified.
 *
 * What makes it worth writing rather than pasting: almost every clause here is
 * a fact about this site rather than boilerplate. Membership really is support
 * and not a gate, so the terms say so instead of describing tiers that do not
 * exist. Suspension really does refuse the next game rather than stopping one
 * in progress. Finished games really are permanent and public, which is the
 * term most likely to surprise somebody, so it gets its own section rather than
 * a clause in the middle of another one.
 */
export default async function TermsOfServicePage() {
	const t = await getTranslations("terms");
	const locale = await getLocale();

	return (
		<LegalDocument
			path={PATH}
			title={t("title")}
			updated={t("updated", { date: formatLegalDate(UPDATED, locale) })}
		>
			<p className="mt-6 text-fg">{t("intro")}</p>
			<p className="mt-3 rounded-lg bg-elevated px-4 py-3 text-fg">
				{t("agreement")}
			</p>

			<LegalSection title={t("eligibilityTitle")}>
				<p>{t("eligibilityBody")}</p>
			</LegalSection>

			<LegalSection title={t("accountTitle")}>
				<p>{t("accountBody")}</p>
				<p>{t("accountResponsible")}</p>
			</LegalSection>

			{/*
			 * Called out rather than buried in a list. Everything else on this page
			 * is what a reader would assume; this is the one they are most likely to
			 * be judged against, so it gets a border and its own colour.
			 */}
			<LegalSection title={t("fairPlayTitle")}>
				<div className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3">
					<p className="text-fg">{t("fairPlayBody")}</p>
					<div className="mt-2 text-fg">
						<LegalBullets
							items={[
								t("fairPlayEngine"),
								t("fairPlayHelp"),
								t("fairPlaySandbag"),
								t("fairPlayStalling"),
							]}
						/>
					</div>
					<p className="mt-3 text-fg">{t("fairPlayNote")}</p>
				</div>
			</LegalSection>

			<LegalSection title={t("conductTitle")}>
				<p>{t("conductBody")}</p>
			</LegalSection>

			<LegalSection title={t("gamesTitle")}>
				<p>{t("gamesBody")}</p>
				<p>{t("gamesRating")}</p>
			</LegalSection>

			<LegalSection title={t("contentTitle")}>
				<p>{t("contentBody")}</p>
			</LegalSection>

			<LegalSection title={t("membershipTitle")}>
				<LegalBullets
					items={[
						t("membershipFree"),
						t("membershipBilling"),
						t("membershipConsumer"),
					]}
				/>
			</LegalSection>

			<LegalSection title={t("moderationTitle")}>
				<p>{t("moderationBody")}</p>
				<p>{t("moderationAppeal")}</p>
			</LegalSection>

			<LegalSection title={t("availabilityTitle")}>
				<p>{t("availabilityBody")}</p>
			</LegalSection>

			<LegalSection title={t("liabilityTitle")}>
				<p>{t("liabilityBody")}</p>
			</LegalSection>

			<LegalSection title={t("changesTitle")}>
				<p>{t("changesBody")}</p>
			</LegalSection>

			<LegalSection title={t("lawTitle")}>
				<p>{t("lawBody")}</p>
			</LegalSection>

			<LegalSection title={t("contactTitle")}>
				<p>{t("contactBody")}</p>
				<LegalEmail address={SUPPORT_EMAIL} />
			</LegalSection>

			{/* The two documents are read together, so each one ends by pointing at
			    the other. */}
			<LegalSection title={t("privacyTitle")}>
				<p>{t("privacyBody")}</p>
				<Link
					className="font-semibold text-primary hover:underline"
					href="/privacy-policy"
				>
					{t("privacyLink")}
				</Link>
			</LegalSection>
		</LegalDocument>
	);
}
