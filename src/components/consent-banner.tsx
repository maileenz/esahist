"use client";

import { Check, Cookie, SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import ConsentCategories from "@/components/consent-categories";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	CONSENT_EVENT,
	CONSENT_OPEN_EVENT,
	type Consent,
	openConsentPreferences,
	readConsent,
	writeConsent,
} from "@/lib/consent";

/**
 * The consent bar, and the preferences behind it.
 *
 * A bar and not a modal. A wall that has to be cleared before the site will
 * respond is a way of making agreement the cheapest way out, and agreement
 * obtained that way is not freely given — which is the whole test. Rejecting is
 * one click, in the same place, in a button the same size as accepting.
 *
 * There is no close button for the same reason. A cross that stores nothing
 * would ask again on every page, and a cross that quietly stores "no" is a
 * decision taken on somebody's behalf. Reject all already does that job, out in
 * the open where it can be counted.
 */
export default function ConsentBanner() {
	// `undefined` until the effect has read storage. The server cannot know what
	// is in this browser, so the first paint has to be nothing at all — anything
	// else is a flash of a bar that may not belong there.
	const t = useTranslations("consent");
	const [consent, setConsent] = useState<Consent | null | undefined>(undefined);
	const [showPreferences, setShowPreferences] = useState(false);
	const [analytics, setAnalytics] = useState(false);

	useEffect(() => {
		const stored = readConsent();
		setConsent(stored);
		setAnalytics(stored?.analytics ?? false);

		const open = () => {
			// Reopened from elsewhere on the page: start from what is stored, so
			// the dialog shows the current answer rather than a fresh no.
			setAnalytics(readConsent()?.analytics ?? false);
			setShowPreferences(true);
		};

		// Withdrawal happens through the same module, so the bar has to hear
		// about it — otherwise clearing the decision leaves the page as it was.
		const changed = (event: Event) => {
			const detail = (event as CustomEvent<Consent | null>).detail;
			setConsent(detail);
			setAnalytics(detail?.analytics ?? false);
		};

		window.addEventListener(CONSENT_OPEN_EVENT, open);
		window.addEventListener(CONSENT_EVENT, changed);
		return () => {
			window.removeEventListener(CONSENT_OPEN_EVENT, open);
			window.removeEventListener(CONSENT_EVENT, changed);
		};
	}, []);

	const decide = useCallback((next: boolean) => {
		writeConsent({ analytics: next });
		setShowPreferences(false);
	}, []);

	if (consent === undefined) return null;

	return (
		<>
			{consent === null && (
				<section
					aria-label={t("barLabel")}
					// Above the page, below the dialog it opens. `pb-safe` is not a
					// thing, so the padding leaves room for a phone's home bar.
					className="fixed inset-x-0 bottom-0 z-40 border-line border-t bg-surface/95 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur"
				>
					<div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:gap-8">
						<div className="min-w-0 flex-1">
							<h2 className="flex items-center gap-2 font-bold text-fg">
								<Cookie aria-hidden className="h-4 w-4 text-muted-foreground" />
								{t("barTitle")}
							</h2>

							<p className="mt-1 text-muted-foreground text-sm">
								{t("barBody")}
							</p>
						</div>

						{/* Stacked and equal width: the three answers are three answers,
						    and sizing one of them larger is a thumb on the scale. */}
						<div className="flex shrink-0 flex-col gap-2 sm:w-52">
							<Button onClick={() => decide(true)} type="button">
								<Check aria-hidden />
								{t("acceptAll")}
							</Button>

							<Button
								onClick={() => decide(false)}
								type="button"
								variant="outline"
							>
								<X aria-hidden />
								{t("rejectAll")}
							</Button>

							<Button
								onClick={openConsentPreferences}
								type="button"
								variant="ghost"
							>
								<SlidersHorizontal aria-hidden />
								{t("preferences")}
							</Button>
						</div>
					</div>
				</section>
			)}

			<Dialog onOpenChange={setShowPreferences} open={showPreferences}>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>{t("dialogTitle")}</DialogTitle>
					</DialogHeader>

					<ConsentCategories
						analytics={analytics}
						onAnalyticsChange={setAnalytics}
					/>

					<DialogFooter>
						<Button
							onClick={() => decide(false)}
							type="button"
							variant="outline"
						>
							{t("rejectAll")}
						</Button>
						<Button onClick={() => decide(analytics)} type="button">
							{t("savePreferences")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
