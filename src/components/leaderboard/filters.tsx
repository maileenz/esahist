"use client";

import { Globe, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { CATEGORY_ICONS } from "@/components/category-icon";
import CountrySelect from "@/components/country-select";
import { toCountryCode } from "@/lib/countries";
import { TIME_CONTROL_CATEGORIES } from "@/lib/timeControls";
import { cn } from "@/lib/utils";

/**
 * What you are looking at: which pool, and whose flags.
 *
 * The pool is a route and the country is a query string, which is the split
 * the two deserve — `/leaderboard/rapid` is a page worth linking to, while
 * `?country=RO` narrows whichever page you are already on and survives
 * switching between them.
 */
export default function Filters({ countries }: { countries: string[] }) {
	const t = useTranslations("leaderboard");
	const categories = useTranslations("categories");
	const pathname = usePathname();
	const params = useSearchParams();
	const router = useRouter();

	// Normalised the same way the routes do it, so `?country=ro` selects
	// Romania in the dropdown rather than falling back to Global.
	const country = toCountryCode(params.get("country"));
	const suffix = country ? `?country=${country}` : "";

	const pools = [
		{ href: "/leaderboard", label: t("allGameTypes"), Icon: LayoutGrid },
		...TIME_CONTROL_CATEGORIES.map((category) => ({
			href: `/leaderboard/${category}`,
			label: categories(category),
			Icon: CATEGORY_ICONS[category],
		})),
	];

	function chooseCountry(code: string) {
		// Same page, different field of players — so the category you are on is
		// kept and only the query changes.
		router.push(code ? `${pathname}?country=${code}` : pathname);
	}

	return (
		<div className="flex flex-wrap items-center gap-2">
			{pools.map(({ href, label, Icon }) => {
				const active = pathname === href;

				return (
					<Link
						aria-current={active ? "page" : undefined}
						className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 font-semibold text-sm transition ${
							active
								? "border-primary bg-brand-soft text-primary"
								: "border-line bg-surface text-muted-foreground hover:bg-elevated hover:text-fg"
						}`}
						href={`${href}${suffix}`}
						key={href}
					>
						<Icon aria-hidden className="h-4 w-4 shrink-0" />
						{label}
					</Link>
				);
			})}

			{/* The same combobox the profile uses, narrowed to countries that
			    actually have a player in this pool — and coloured like the pool
			    pills beside it, so the row reads as one set of filters. */}
			<CountrySelect
				align="end"
				className={cn(
					"ml-auto h-auto w-auto rounded-xl px-4 py-2.5 font-semibold text-sm",
					country
						? "border-primary bg-brand-soft text-primary hover:bg-brand-soft hover:text-primary"
						: "border-line bg-surface",
				)}
				codes={countries}
				emptyIcon={<Globe aria-hidden className="h-4 w-4 shrink-0" />}
				emptyLabel={t("global")}
				onChange={chooseCountry}
				value={country ?? ""}
			/>
		</div>
	);
}
