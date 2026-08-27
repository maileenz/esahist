import GameHistoryList from "@/components/member/game-history-list";
import { api, HydrateClient } from "@/trpc/server";

/** The full archive, one long list. The overview links here with "See more". */
export default async function MemberGamesPage({
	params,
}: {
	params: Promise<{ username: string }>;
}) {
	const { username } = await params;

	// The layout has already resolved the member and redirected anyone signed
	// out; lowercasing keeps the query key identical to the client's.
	const handle = decodeURIComponent(username).toLowerCase();

	// Not awaited: the request fires here and the promise lands in the query
	// cache, which `HydrateClient` serialises into the tree. The client picks up
	// the first page with `useSuspenseInfiniteQuery`, so the skeleton only shows
	// if it is still in flight when the shell streams.
	void api.member.games.prefetchInfinite({ username: handle });

	return (
		<HydrateClient>
			<GameHistoryList username={handle} />
		</HydrateClient>
	);
}
