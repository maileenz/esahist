import { Settings } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import SettingsNav from "@/components/settings/settings-nav";
import { canonical, NOINDEX } from "@/lib/seo";
import { auth } from "@/server/auth";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("settingsNav");
	return {
		title: t("title"),
		alternates: canonical("/settings"),
		// Inherited by every section under here, which is the point — an account's
		// own settings are the last thing that belongs in an index.
		robots: NOINDEX,
	};
}

/**
 * Title and the section list, shared by every settings route.
 *
 * One card holding a rail and a panel, the way chess.com lays it out: the rail
 * is navigation between sibling routes, so each section is linkable and loads
 * only its own data.
 */
export default async function SettingsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const t = await getTranslations("settingsNav");
	const session = await auth();
	if (!session?.user) redirect("/login?callbackUrl=%2Fsettings");

	return (
		<main className="mx-auto w-full max-w-4xl p-4">
			<h1 className="flex items-center gap-3 font-bold text-2xl text-fg">
				<Settings aria-hidden className="h-7 w-7 text-muted-foreground" />
				{t("title")}
			</h1>

			<div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface shadow-sm md:flex">
				<SettingsNav />

				{/* `min-w-0` so a wide panel scrolls inside itself rather than
				    stretching the card past the page. */}
				<section className="min-w-0 flex-1 p-5">{children}</section>
			</div>
		</main>
	);
}
