"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
} from "@/components/ui/select";
import { type AppLocale, LOCALE_LABELS, LOCALES } from "@/i18n/locales";
import { setLocale } from "@/i18n/set-locale";

/**
 * The language switch, beside the wordmark.
 *
 * Out in the rail rather than three clicks deep in the appearance dialog: a
 * reader who cannot read the interface cannot find a settings screen labelled
 * in a language they do not have. It is the one preference that has to be
 * reachable without reading anything, so it sits where the eye already goes.
 *
 * The trigger shows the code — `EN`, `RO` — because the rail is 224px wide and
 * "Română" beside the wordmark does not fit. The menu shows the full names,
 * each written in its own language and never translated: somebody looking for
 * their language is looking for the word *they* would use for it, not for
 * "Romanian" rendered in a language they cannot read.
 */
export default function LanguageSelect() {
	const t = useTranslations("appearance");
	const locale = useLocale();
	const router = useRouter();
	const [switching, startSwitching] = useTransition();

	/*
	 * The language is server state — it decides what the *next* render says — so
	 * switching it writes a cookie and asks for the page again, rather than
	 * swapping strings in place and leaving the server's copy behind.
	 */
	const choose = (next: string) => {
		if (next === locale) return;
		startSwitching(async () => {
			await setLocale(next as AppLocale);
			router.refresh();
		});
	};

	return (
		<Select disabled={switching} onValueChange={choose} value={locale}>
			<SelectTrigger
				aria-label={t("language")}
				className="gap-1 border-none px-2 font-semibold text-muted-foreground text-xs uppercase shadow-none hover:bg-elevated hover:text-fg focus-visible:ring-0"
				size="sm"
			>
				{/*
				 * The code, not `SelectValue`. `SelectValue` mirrors whatever the
				 * chosen item renders, which here is the full name — and that is the
				 * one thing this trigger has no room for.
				 */}
				<span>{locale}</span>
			</SelectTrigger>

			{/*
			 * `position="popper"` is not optional here. This build of the shadcn
			 * select defaults to `item-aligned`, which places the menu so the chosen
			 * item sits over the trigger — near the top of a tall page that put it a
			 * thousand pixels down, open but out of sight. Popper anchors it to the
			 * trigger, and it is also what makes `align` mean anything.
			 */}
			<SelectContent align="end" position="popper" sideOffset={6}>
				{LOCALES.map((code) => (
					<SelectItem key={code} value={code}>
						{LOCALE_LABELS[code]}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
