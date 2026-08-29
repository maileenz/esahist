"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { isReportReason } from "@/lib/reportReasons";
import { confirmDestructive } from "@/lib/sweet-alert";

import { api } from "@/trpc/react";

type Status = "open" | "reviewed" | "dismissed";

/** Ids only — the labels live in the catalogue, keyed by the same id. */
const TABS: Status[] = ["open", "reviewed", "dismissed"];

export default function ReportQueue({
	status,
	page,
}: {
	status: Status;
	page: number;
}) {
	const t = useTranslations("admin");
	const reasons = useTranslations("report.reasons");
	const [data] = api.admin.reports.useSuspenseQuery({ status, page });

	const utils = api.useUtils();
	const refresh = () => void utils.admin.invalidate();

	const resolve = api.admin.resolve.useMutation({ onSuccess: refresh });
	const setBanned = api.admin.setBanned.useMutation({
		onSuccess: (result) => {
			refresh();
			toast.success(result.banned ? t("suspended") : t("suspensionLifted"));
		},
		onError: (error) => toast.error(error.message),
	});

	const lastPage = Math.max(0, Math.ceil(data.total / data.pageSize) - 1);

	return (
		<div>
			<nav className="mb-4 flex gap-1 rounded-lg border border-line bg-elevated p-1 text-sm">
				{TABS.map((tab) => (
					<Link
						className={`flex-1 rounded-md px-3 py-1.5 text-center font-medium transition ${
							tab === status
								? "bg-surface text-fg shadow-sm"
								: "text-muted-foreground hover:text-fg"
						}`}
						href={tab === "open" ? "/admin" : `/admin?status=${tab}`}
						key={tab}
					>
						{t(tab)}
						{tab === status && data.total > 0 ? ` (${data.total})` : ""}
					</Link>
				))}
			</nav>

			{data.rows.length === 0 ? (
				<p className="rounded-xl border border-line bg-surface p-5 text-muted-foreground text-sm shadow-sm">
					{t("emptyQueue")}
				</p>
			) : (
				<ul className="space-y-3">
					{data.rows.map((report) => (
						<li
							className="rounded-xl border border-line bg-surface p-4 shadow-sm"
							key={report.id}
						>
							<div className="flex flex-wrap items-start justify-between gap-3">
								<div className="min-w-0">
									<p className="text-fg">
										<Link
											className="font-semibold hover:underline"
											href={`/member/${report.reportedUsername}`}
										>
											{report.reportedName ?? report.reportedUsername}
										</Link>
										<span className="text-muted-foreground"> </span>
										{report.reportedBanned && (
											<span className="ml-2 rounded bg-danger-soft px-2 py-0.5 text-danger text-xs">
												{t("suspendedBadge")}
											</span>
										)}
									</p>
									<p className="mt-1 font-medium text-danger text-sm">
										{isReportReason(report.reason)
											? reasons(report.reason)
											: report.reason}
									</p>
									<p className="mt-1 text-muted-foreground text-xs">
										reported by{" "}
										<Link
											className="hover:underline"
											href={`/member/${report.reporterUsername}`}
										>
											{report.reporterName ?? report.reporterUsername}
										</Link>{" "}
										· {new Date(report.createdAt).toLocaleString()}
									</p>
								</div>

								<div className="flex flex-wrap gap-2">
									{status === "open" && (
										<>
											<button
												className="rounded-lg border border-line px-3 py-1.5 font-medium text-fg text-sm transition hover:bg-elevated"
												disabled={resolve.isPending}
												onClick={() =>
													resolve.mutate({ id: report.id, status: "reviewed" })
												}
												type="button"
											>
												{t("markReviewed")}
											</button>
											<button
												className="rounded-lg border border-line px-3 py-1.5 font-medium text-muted-foreground text-sm transition hover:bg-elevated hover:text-fg"
												disabled={resolve.isPending}
												onClick={() =>
													resolve.mutate({ id: report.id, status: "dismissed" })
												}
												type="button"
											>
												{t("dismiss")}
											</button>
										</>
									)}

									<button
										className={`rounded-lg px-3 py-1.5 font-semibold text-sm transition ${
											report.reportedBanned
												? "border border-line text-fg hover:bg-elevated"
												: "bg-danger text-white hover:brightness-110"
										}`}
										disabled={setBanned.isPending}
										onClick={async () => {
											const banning = !report.reportedBanned;
											const name =
												report.reportedName ?? report.reportedUsername;
											const confirmed = await confirmDestructive({
												title: banning
													? t("suspendTitleNamed", { name })
													: t("liftTitleNamed", { name }),
												text: banning ? t("suspendText") : t("liftText"),
												confirmText: banning
													? t("suspend")
													: t("liftSuspension"),
											});
											if (confirmed) {
												setBanned.mutate({
													username: report.reportedUsername,
													banned: banning,
												});
											}
										}}
										type="button"
									>
										{report.reportedBanned ? t("unsuspend") : t("suspend")}
									</button>
								</div>
							</div>
						</li>
					))}
				</ul>
			)}

			{data.total > data.pageSize && (
				<div className="mt-3 flex items-center justify-between text-sm">
					<PagerLink disabled={page === 0} href={pageHref(status, page - 1)}>
						{t("newer")}
					</PagerLink>
					<span className="text-muted-foreground tabular-nums">
						Page {page + 1} of {lastPage + 1} · {data.total} reports
					</span>
					<PagerLink
						disabled={page >= lastPage}
						href={pageHref(status, page + 1)}
					>
						{t("older")}
					</PagerLink>
				</div>
			)}
		</div>
	);
}

/** Paging lives in the URL so the server prefetches the page being rendered. */
function pageHref(status: Status, page: number): string {
	const params = new URLSearchParams();
	if (status !== "open") params.set("status", status);
	if (page > 0) params.set("page", String(page));
	const query = params.toString();
	return query ? `/admin?${query}` : "/admin";
}

function PagerLink({
	href,
	disabled,
	children,
}: {
	href: string;
	disabled: boolean;
	children: React.ReactNode;
}) {
	const className =
		"rounded-lg border border-line px-3 py-1.5 font-medium transition";

	if (disabled) {
		return (
			<span className={`${className} cursor-not-allowed text-subtle`}>
				{children}
			</span>
		);
	}

	return (
		<Link className={`${className} text-fg hover:bg-elevated`} href={href}>
			{children}
		</Link>
	);
}
