"use client";

import { useTranslations } from "next-intl";

/**
 * A failed suspense query throws rather than returning an error flag, so the
 * segment needs a boundary of its own — otherwise a hiccup loading one tab
 * takes down the whole page instead of the panel below the header.
 */
export default function MemberError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	const common = useTranslations("common");
	const t = useTranslations("profile");
	return (
		<div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
			<p className="font-medium text-fg">{t("didntLoad")}</p>
			<p className="mt-1 text-muted-foreground text-sm">
				{error.message || t("loadError")}
			</p>
			<button
				className="mt-4 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground text-sm transition hover:bg-brand-strong"
				onClick={reset}
				type="button"
			>
				{common("retry")}
			</button>
		</div>
	);
}
