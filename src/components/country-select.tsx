"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import Flag from "@/components/flag";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import type { AppLocale } from "@/i18n/locales";
import { countryName, countryOptions } from "@/lib/countries";
import { cn } from "@/lib/utils";

/**
 * Sorted once per locale rather than per render: `countryOptions()` puts 249
 * names through `localeCompare`, and the answer only changes when the language
 * does — which, since the order is by translated name, it genuinely has to.
 */
const sorted = new Map<AppLocale, { code: string; name: string }[]>();

function allCountries(locale: AppLocale) {
	const cached = sorted.get(locale);
	if (cached) return cached;

	const options = countryOptions(locale);
	sorted.set(locale, options);
	return options;
}

/**
 * Pick a country.
 *
 * A combobox rather than a `<select>`, which is the whole reason this exists:
 * finding Romania in a native dropdown means scrolling past two hundred
 * entries, and the type-ahead only matches the first letter. Here it is three
 * keystrokes.
 *
 * `""` is an answer and not a missing value — "I would rather not fly a flag"
 * on a profile, "everybody" on a leaderboard — so it is a row in the list
 * rather than something reachable only by clearing. What that row is called is
 * the caller's business, which is what `emptyLabel` is for.
 */
export default function CountrySelect({
	value,
	onChange,
	codes,
	emptyLabel,
	emptyIcon,
	align = "start",
	disabled = false,
	id,
	className,
}: {
	/** ISO 3166-1 alpha-2, or `""` for none. */
	value: string;
	onChange: (value: string) => void;
	/**
	 * Restricts the list. The leaderboards pass the countries that actually
	 * have a player in them — offering the other two hundred would be offering
	 * to filter a page down to nobody.
	 */
	codes?: readonly string[];
	/** What `""` is called here: "No country" on a profile, "Global" on a table. */
	emptyLabel?: string;
	/** Shown beside `emptyLabel` on the trigger, where a flag would otherwise be. */
	emptyIcon?: React.ReactNode;
	align?: "start" | "end";
	disabled?: boolean;
	id?: string;
	className?: string;
}) {
	const t = useTranslations("ui");
	const locale = useLocale();
	const [open, setOpen] = useState(false);

	const options = useMemo(() => {
		const all = allCountries(locale);
		if (!codes) return all;
		const allowed = new Set(codes);
		return all.filter((option) => allowed.has(option.code));
	}, [codes, locale]);

	const choose = (next: string) => {
		onChange(next);
		setOpen(false);
	};

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger asChild>
				<Button
					aria-expanded={open}
					className={cn("w-full justify-between font-normal", className)}
					disabled={disabled}
					id={id}
					role="combobox"
					type="button"
					variant="outline"
				>
					<span className="flex min-w-0 items-center gap-2">
						{value ? (
							<>
								<Flag className="shrink-0 rounded-xs" code={value} />
								<span className="truncate">{countryName(value, locale)}</span>
							</>
						) : (
							<span className="flex items-center gap-2 text-muted-foreground">
								{emptyIcon}
								{emptyLabel}
							</span>
						)}
					</span>
					<ChevronsUpDown className="size-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>

			{/* Matches the trigger rather than a fixed width, so the list is as
			    wide as the control it belongs to. */}
			<PopoverContent
				align={align}
				className="w-[max(16rem,var(--radix-popover-trigger-width))] p-0"
			>
				<Command>
					<CommandInput placeholder={t("searchCountries")} />
					<CommandList className="max-h-64">
						<CommandEmpty>{t("noCountryMatch")}</CommandEmpty>
						<CommandGroup>
							<CommandItem onSelect={() => choose("")} value={emptyLabel}>
								<Check
									className={cn(
										"size-4",
										value === "" ? "opacity-100" : "opacity-0",
									)}
								/>
								{emptyIcon}
								<span className="text-muted-foreground">{emptyLabel}</span>
							</CommandItem>

							{options.map((option) => (
								<CommandItem
									key={option.code}
									onSelect={() => choose(option.code)}
									// cmdk matches on this, so it has to be the name and
									// not the code — nobody searches for "RO".
									value={option.name}
								>
									<Check
										className={cn(
											"size-4",
											value === option.code ? "opacity-100" : "opacity-0",
										)}
									/>
									<Flag className="shrink-0 rounded-xs" code={option.code} />
									{option.name}
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
