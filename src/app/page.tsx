import { redirect } from "next/navigation";

import PlayShell from "@/components/play-shell";
import { auth } from "@/server/auth";
import { api } from "@/trpc/server";

export default async function PlayPage({
	searchParams,
}: {
	searchParams: Promise<{ tc?: string }>;
}) {
	const session = await auth();
	if (!session?.user) redirect("/login");

	const { tc } = await searchParams;

	// Awaited rather than prefetched: the lobby needs a rating before it can ask
	// for a matchmaking bucket, and every clock has its own. Nothing here is
	// load-bearing — the game server re-reads the pool during onAuth. The seat
	// comes with it so the board can show you before a game exists.
	const [ratings, seat] = await Promise.all([
		api.game.ratings(),
		api.game.seat(),
	]);

	return <PlayShell initialTimeControl={tc} ratings={ratings} seat={seat} />;
}
