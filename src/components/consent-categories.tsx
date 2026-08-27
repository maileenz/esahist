"use client";

import { useTranslations } from "next-intl";
import { Switch } from "@/components/ui/switch";
import { CONSENT_CATEGORIES } from "@/lib/consent";
import { cn } from "@/lib/utils";

/**
 * The switches, wherever the question is being asked.
 *
 * Two places ask it — the banner on a first visit, and Settings afterwards —
 * and they have to agree, not merely look similar. Both render this, from the
 * same catalogue, so there is one description of what is stored and one row
 * that says whether it is on.
 *
 * The locked category is shown rather than hidden. It is the honest answer to
 * "what is always on?", and leaving it out would suggest the answer is nothing.
 */
export default function ConsentCategories({
	analytics,
	onAnalyticsChange,
	className,
}: {
	analytics: boolean;
	onAnalyticsChange: (next: boolean) => void;
	className?: string;
}) {
	const t = useTranslations("consent");
	return (
		<div className={cn("flex flex-col gap-3", className)}>
			{CONSENT_CATEGORIES.map((category) => (
				<div
					className="flex items-start justify-between gap-4 rounded-lg border border-line p-3"
					key={category.id}
				>
					<div className="min-w-0">
						<p className="font-semibold text-fg text-sm">
							{t(`categories.${category.id}.title`)}
						</p>
						<p className="mt-1 text-muted-foreground text-sm">
							{t(`categories.${category.id}.description`)}
						</p>
					</div>

					<div className="shrink-0 pt-1">
						{category.locked ? (
							<Switch
								aria-label={t("alwaysOn", {
									category: t(`categories.${category.id}.title`),
								})}
								checked
								disabled
							/>
						) : (
							<Switch
								aria-label={t(`categories.${category.id}.title`)}
								checked={analytics}
								onCheckedChange={onAnalyticsChange}
							/>
						)}
					</div>
				</div>
			))}
		</div>
	);
}
