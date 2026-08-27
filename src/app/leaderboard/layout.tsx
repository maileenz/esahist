import { Trophy } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import Filters from "@/components/leaderboard/filters";
import { auth } from "@/server/auth";
import { api } from "@/trpc/server";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("leaderboard");
	return { title: t("metaTitle") };
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
	const session = await auth();
	if (!session?.user) redirect("/login?callbackUrl=%2Fleaderboard");

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
