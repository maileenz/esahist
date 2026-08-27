import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import ReportQueue from "@/components/admin/report-queue";
import { auth } from "@/server/auth";
import { api, HydrateClient } from "@/trpc/server";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("admin");
	return { title: t("metaTitle") };
}

const STATUSES = ["open", "reviewed", "dismissed"] as const;
type Status = (typeof STATUSES)[number];

function statusFrom(value: string | undefined): Status {
	return STATUSES.includes(value as Status) ? (value as Status) : "open";
}

function pageFrom(value: string | undefined): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

export default async function AdminPage({
	searchParams,
}: {
	searchParams: Promise<{ status?: string; page?: string }>;
}) {
	const t = await getTranslations("admin");
	const session = await auth();
	if (!session?.user) redirect("/login?callbackUrl=%2Fadmin");

	// 404 rather than 403: there is no reason to tell a member the route exists.
	// The procedures check the role again, so this is presentation, not the gate.
	if (session.user.role !== "admin") notFound();

	const { status, page } = await searchParams;
	const queue = statusFrom(status);
	const pageIndex = pageFrom(page);

	void api.admin.reports.prefetch({ status: queue, page: pageIndex });

	return (
		<main className="mx-auto w-full max-w-3xl p-4">
			<header className="mb-4">
				<h1 className="font-semibold text-fg text-xl">{t("title")}</h1>
				<p className="text-muted-foreground text-sm">{t("subtitle")}</p>
			</header>

			<HydrateClient>
				<ReportQueue page={pageIndex} status={queue} />
			</HydrateClient>
		</main>
	);
}
