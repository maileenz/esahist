"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import ConsentCategories from "@/components/consent-categories";
import { Button } from "@/components/ui/button";
import {
	CONSENT_EVENT,
	type Consent,
	forgetConsent,
	readConsent,
	writeConsent,
} from "@/lib/consent";

/**
 * The cookie choice, somewhere it can be found later.
 *
 * The banner is a one-off: it asks, it is answered, it goes. This is the place
 * that is still here in six months, which is what makes withdrawing as easy as
 * agreeing was — the part of the law that a banner alone never satisfies.
 *
 * Unlike every other panel in Settings, none of this touches the account. The
 * answer belongs to the browser it was given in, so a member who signs in on a
 * borrowed laptop has not thereby agreed to anything on it, and the page says
 * as much rather than leaving it to be discovered.
 */
export default function PrivacySettings() {
	// `undefined` until the effect has read storage: the server has no idea what
	// this browser holds, so there is nothing honest to render on the way past.
	const t = useTranslations("privacy");
	const common = useTranslations("common");
	const [stored, setStored] = useState<Consent | null | undefined>(undefined);
	const [analytics, setAnalytics] = useState(false);

	useEffect(() => {
		const apply = (consent: Consent | null) => {
			setStored(consent);
			setAnalytics(consent?.analytics ?? false);
		};

		apply(readConsent());

		// The banner writes through the same module, so a decision made down
		// there while this page is open lands here too.
		const changed = (event: Event) =>
			apply((event as CustomEvent<Consent | null>).detail);

		window.addEventListener(CONSENT_EVENT, changed);
		return () => window.removeEventListener(CONSENT_EVENT, changed);
	}, []);

	if (stored === undefined) return <Skeleton />;

	// An unanswered banner counts as dirty: Save is how somebody answers it from
	// here, and it would be odd for the button to be dead on the one screen that
	// exists to take the answer.
	const dirty = stored === null || analytics !== stored.analytics;

	const save = () => {
		writeConsent({ analytics });
		toast.success(t("saved"));
	};

	const reset = () => {
		forgetConsent();
		toast.success(t("cleared"));
	};

	return (
		<div className="flex flex-col gap-5">
			<header>
				<h2 className="font-bold text-fg text-xl">{t("title")}</h2>
				<p className="mt-1 text-muted-foreground text-sm">{t("subtitle")}</p>
			</header>

			<div>
				<h3 className="font-bold text-fg text-lg">{t("cookies")}</h3>
				<p className="mt-1 text-muted-foreground text-sm">{t("cookiesNote")}</p>
			</div>

			<ConsentCategories
				analytics={analytics}
				onAnalyticsChange={setAnalytics}
			/>

			<p className="text-sm text-subtle">
				{stored === null
					? t("unanswered")
					: t("answeredOn", { date: answeredOn(stored.decidedAt) })}
			</p>

			<div className="flex flex-wrap gap-3">
				<Button disabled={!dirty} onClick={save} type="button">
					{common("save")}
				</Button>

				<Button
					disabled={!dirty}
					onClick={() => setAnalytics(stored?.analytics ?? false)}
					type="button"
					variant="outline"
				>
					{common("cancel")}
				</Button>

				{/* Not the same as switching everything off: this forgets that the
				    question was ever answered, which is what somebody handing the
				    laptop back actually wants. */}
				<Button
					className="ml-auto"
					disabled={stored === null}
					onClick={reset}
					type="button"
					variant="ghost"
				>
					{t("forget")}
				</Button>
			</div>
		</div>
	);
}

function answeredOn(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "an unknown date";

	return date.toLocaleDateString(undefined, {
		day: "numeric",
		month: "long",
		year: "numeric",
	});
}

/** Holds the panel's height for the one frame before storage has been read. */
function Skeleton() {
	return (
		<div aria-hidden className="flex flex-col gap-5">
			<div className="h-14 rounded-lg bg-elevated" />
			<div className="h-24 rounded-lg bg-elevated" />
			<div className="h-24 rounded-lg bg-elevated" />
		</div>
	);
}
