import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import GameReplay from "@/components/member/game-replay";
import { auth } from "@/server/auth";
import { gameById } from "@/trpc/cached";

/**
 * Names the players, because this is the page people paste into a chat. A
 * shared link that says "Game" tells nobody whether it is worth opening.
 *
 * Signed-out visitors get the generic title: the page redirects them to sign in
 * anyway, and a title is not the place to leak who played whom.
 */
export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> {
	const { id } = await params;

	const session = await auth();
	if (!session?.user) return { title: "Game · Grand Master" };

	const game = await gameById(id);
	if (!game) return { title: "Game · Grand Master" };

	const played = new Date(game.startedAt).toLocaleDateString("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});

	return {
		title: `${game.whiteUsername} vs ${game.blackUsername} · Grand Master`,
		description: `${game.result ?? "Unfinished"} · ${game.timeControl} ${
			game.ranked ? "rated" : "casual"
		} · ${played}`,
	};
}

export default async function GamePage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	const session = await auth();
	if (!session?.user) {
		redirect(`/login?callbackUrl=${encodeURIComponent(`/game/${id}`)}`);
	}

	// Already resolved by `generateMetadata`; `gameById` is what stops that
	// being a second trip to the database.
	const game = await gameById(id);
	if (!game) notFound();

	return <GameReplay game={game} />;
}
