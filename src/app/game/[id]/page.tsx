import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import JsonLd from "@/components/json-ld";
import GameReplay from "@/components/member/game-replay";
import {
	breadcrumbs,
	canonical,
	NOINDEX,
	openGraphFor,
	SITE_NAME,
	twitterFor,
} from "@/lib/seo";
import { gameById } from "@/trpc/cached";

/**
 * Names the players, because this is the page people paste into a chat. A
 * shared link that says "Game" tells nobody whether it is worth opening.
 *
 * Everyone gets the real title now that the page is public — it used to fall
 * back to a generic one for signed-out readers, which was the right answer
 * while they were about to be bounced to sign-in and the wrong one for a card
 * unfurling in somebody's chat.
 */
export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> {
	const { id } = await params;
	const t = await getTranslations("game");
	const locale = await getLocale();

	const url = `/game/${encodeURIComponent(id)}`;
	const game = await gameById(id);
	if (!game) return { title: t("metaTitle"), alternates: canonical(url) };

	// The reader's own date order: 5 Aug 2026 here, 5 aug. 2026 in Romanian.
	// Pinning this to en-GB made every tab English regardless of the language.
	const played = new Date(game.startedAt).toLocaleDateString(locale, {
		day: "numeric",
		month: "short",
		year: "numeric",
	});

	const lobby = await getTranslations("lobby");
	const title = t("metaVersus", {
		white: game.whiteUsername,
		black: game.blackUsername,
	});
	const description = t("metaDescription", {
		result: game.result ?? t("unfinished"),
		control: game.timeControl,
		mode: game.ranked ? lobby("rated") : lobby("casual"),
		date: played,
	});

	return {
		title,
		description,
		alternates: canonical(url),
		openGraph: openGraphFor({ description, locale, title, url }),
		twitter: twitterFor({ description, title }),
		/*
		 * A game still in progress is not a page: it is a different page every
		 * minute, and whatever a crawler stored would be wrong by the time anybody
		 * clicked it. It becomes indexable the moment it ends — which is also when
		 * it enters the sitemap.
		 */
		...(game.status === "playing" ? { robots: NOINDEX } : {}),
	};
}

export default async function GamePage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	// No sign-in gate: a finished game is a record two people can share, and the
	// link has to work for whoever they send it to.

	// Already resolved by `generateMetadata`; `gameById` is what stops that
	// being a second trip to the database.
	const game = await gameById(id);
	if (!game) notFound();

	const t = await getTranslations("game");

	return (
		<>
			{/*
			 * Home › white vs black. Two levels rather than three: there is no game
			 * index to sit in the middle, and a game belongs to two players equally,
			 * so neither profile can honestly be its parent.
			 */}
			<JsonLd
				data={breadcrumbs([
					{ name: SITE_NAME, path: "/" },
					{
						name: t("metaVersus", {
							white: game.whiteUsername,
							black: game.blackUsername,
						}),
						path: `/game/${encodeURIComponent(id)}`,
					},
				])}
			/>

			<GameReplay game={game} />
		</>
	);
}
