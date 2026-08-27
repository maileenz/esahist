"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * A game that fails to load should not take the shell down with it — a bad id,
 * a dropped database connection, a move sheet that will not parse.
 */
export default function GameError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	const common = useTranslations("common");
	const t = useTranslations("profile");
	return (
		<div className="mx-auto w-full max-w-5xl p-4">
			<div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
				<p className="font-medium text-fg">{t("gameDidntLoad")}</p>
				<p className="mt-1 text-muted-foreground text-sm">
					{error.message || t("gameLoadError")}
				</p>
				<Button className="mt-4" onClick={reset} type="button">
					{common("retry")}
				</Button>
			</div>
		</div>
	);
}
