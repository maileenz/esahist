import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import PlayComputer from "@/components/play-computer";
import PlayShell from "@/components/play-shell";
import { canonical, openGraphFor, SITE_NAME, twitterFor } from "@/lib/seo";
import { auth } from "@/server/auth";
import { api } from "@/trpc/server";

/**
 * The home page keeps the bare brand as its title — `title.default` in the root
 * layout — because "Esahist.ro · Esahist.ro" is what a template would make of a
 * name here.
 *
 * `?tc=` picks which clock the lobby opens on. It is a starting position, not a
 * different page, so every one of them canonicalises to `/`.
 *
 * The description is the visitor's page rather than the lobby's, because the
 * signed-out version is the one a crawler and a search result ever see.
 */
export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("common");
	const locale = await getLocale();
	const description = t("metaDescription");

	return {
		alternates: canonical("/"),
		openGraph: openGraphFor({
			description,
			locale,
			title: SITE_NAME,
			url: "/",
		}),
		twitter: twitterFor({ description, title: SITE_NAME }),
	};
}

export default async function PlayPage({
	searchParams,
}: {
	searchParams: Promise<{ tc?: string }>;
}) {
	const session = await auth();

	/*
	 * A visitor gets a board instead of a door.
	 *
	 * This used to redirect to `/login`, which made the one address every search
	 * result lands on a sign-in screen. The lobby genuinely cannot work without
	 * an account — matchmaking needs a rating and a seat — so the answer is not
	 * to open it but to put something real here: an opponent that runs in the
	 * page, on the same board a member plays on.
	 */
	if (!session?.user) return <PlayComputer />;

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
