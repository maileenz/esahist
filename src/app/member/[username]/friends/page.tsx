import FriendsList from "@/components/friends/friends-list";
import { api, HydrateClient } from "@/trpc/server";

/**
 * Whose friends these are is the only thing this page knows. Your own inbox,
 * outbox and block list live on `/friends` — none of them belong on a page
 * other people read, and keeping them out is what lets this render the same way
 * for everybody.
 */
export default async function MemberFriendsPage({
	params,
}: {
	params: Promise<{ username: string }>;
}) {
	const { username } = await params;
	const handle = decodeURIComponent(username).toLowerCase();

	// Infinite, so the first page is seeded with `prefetchInfinite`; the input
	// must match the client's first call exactly or the cache entry is ignored.
	void api.friend.list.prefetchInfinite({ username: handle, search: "" });

	return (
		<HydrateClient>
			<FriendsList username={handle} />
		</HydrateClient>
	);
}
