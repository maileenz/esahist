"use client";

import { api } from "@/trpc/react";

/**
 * Reports waiting in the moderation queue. The query is an `adminProcedure`, so
 * this only ever resolves for an admin — a member who somehow rendered it would
 * get a FORBIDDEN and see nothing.
 */
export default function OpenReportsBadge({ dot }: { dot?: boolean }) {
	const { data } = api.admin.openCount.useQuery(undefined, {
		refetchInterval: 60_000,
		refetchOnWindowFocus: true,
	});

	if (!data) return null;

	if (dot) {
		return (
			<span
				aria-label={`${data} reports waiting`}
				className="block h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-surface"
				role="status"
			/>
		);
	}

	return (
		<span
			aria-label={`${data} reports waiting`}
			className="rounded-full bg-danger px-1.5 py-0.5 font-bold text-[11px] text-white tabular-nums"
			role="status"
		>
			{data}
		</span>
	);
}
