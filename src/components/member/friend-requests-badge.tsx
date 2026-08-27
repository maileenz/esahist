"use client";

import { api } from "@/trpc/react";

/**
 * How many friend requests are waiting. Renders nothing when the inbox is
 * empty, so the nav item stays quiet until there is something to see.
 *
 * `dot` is the collapsed-rail form: the same signal with no room for digits.
 */
export default function FriendRequestsBadge({ dot }: { dot?: boolean }) {
	const { data } = api.friend.pendingCount.useQuery(undefined, {
		// Requests arrive while you are elsewhere on the site.
		refetchInterval: 60_000,
		refetchOnWindowFocus: true,
	});

	if (!data) return null;

	if (dot) {
		return (
			<span
				aria-label={`${data} friend requests waiting`}
				className="block h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-surface"
				role="status"
			/>
		);
	}

	return (
		<span
			aria-label={`${data} friend requests waiting`}
			className="rounded-full bg-primary px-1.5 py-0.5 font-bold text-[11px] text-primary-foreground tabular-nums"
			role="status"
		>
			{data}
		</span>
	);
}
