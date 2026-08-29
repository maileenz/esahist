import { Users } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import FriendsList from "@/components/friends/friends-list";
import PendingRequests from "@/components/friends/pending-requests";
import { canonical, NOINDEX } from "@/lib/seo";
import { auth } from "@/server/auth";
import { api, HydrateClient } from "@/trpc/server";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("friends");
	return {
		title: t("title"),
		alternates: canonical("/friends"),
		// Your inbox. There is nothing here for anyone who is not you, and a
		// crawler that follows a link to it is served the login page.
		robots: NOINDEX,
	};
}

/**
 * Your friends, and the requests in both directions.
 *
 * A route of its own rather than a tab on your profile, because an inbox and an
 * outbox are yours and a profile is the page other people read. What is left on
 * the profile is the friends list, which is the only part of this anybody else
 * can see.
 *
 * The block list is not here: it is the opposite of a friend list, and it lives
 * with the other privacy settings.
 *
 * Both request lists come before the friends list, and the friends list is last
 * because it pages forever: anything under an infinite scroll is not below the
 * fold, it is unreachable. The requests are also the part that is waiting on
 * you, so they are what you land on.
 */
export default async function FriendsPage() {
	const t = await getTranslations("friends");
	const session = await auth();
	const username = session?.user?.username;
	if (!username) redirect("/login?callbackUrl=%2Ffriends");

	// Infinite, so the first page is seeded with `prefetchInfinite`; the input
	// must match the client's first call exactly or the cache entry is ignored.
	void api.friend.list.prefetchInfinite({ username, search: "" });
	void api.friend.pending.prefetch(undefined);

	return (
		<HydrateClient>
			<main className="mx-auto w-full max-w-4xl p-4">
				<h1 className="flex items-center gap-3 font-bold text-2xl text-fg">
					<Users aria-hidden className="h-7 w-7 text-primary" />
					{t("heading")}
				</h1>

				<div className="mt-4 flex flex-col gap-3">
					<PendingRequests direction="incoming" />
					<PendingRequests direction="outgoing" />
					<FriendsList username={username} />
				</div>
			</main>
		</HydrateClient>
	);
}
