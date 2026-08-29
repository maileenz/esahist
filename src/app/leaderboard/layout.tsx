import { Trophy } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import Filters from "@/components/leaderboard/filters";
import { canonical, openGraphFor, twitterFor } from "@/lib/seo";
import { api } from "@/trpc/server";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("leaderboard");
	const locale = await getLocale();
	const title = t("metaTitle");
	const description = t("metaDescription");

	return {
		title,
		description,
		// `?country=` filters the same table rather than making a new page, so the
		// bare path is the address of all of them.
		alternates: canonical("/leaderboard"),
		openGraph: openGraphFor({
			description,
			locale,
			title,
			url: "/leaderboard",
		}),
		twitter: twitterFor({ description, title }),
	};
}

/**
 * Title and the filters, shared by the overview and each pool's table — both
 * of which are routes, so switching between them re-renders only the standings
 * below.
 */
export default async function LeaderboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const t = await getTranslations("leaderboard");

	// No sign-in gate: this is the one part of the site a stranger is meant to
	// be able to read, and the procedures behind it are public to match. The rail
	// is drawn by the root layout either way, so there is no chrome to decide on
	// here any more.
	const countries = await api.leaderboard.countries();

	return (
		<main className="mx-auto w-full max-w-4xl p-4">
			<h1 className="flex items-center gap-3 font-bold text-2xl text-fg">
				<Trophy aria-hidden className="h-7 w-7 text-primary" />
				{t("title")}
			</h1>

			<div className="mt-4">
				{/* The country lives in the query string, which a layout is not given —
				    so the row that reads it is a client component. */}
				<Filters countries={countries} />
			</div>

			<div className="mt-4">{children}</div>
		</main>
	);
}
