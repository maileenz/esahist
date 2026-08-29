import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";

import JsonLd from "@/components/json-ld";
import ProfileHeader from "@/components/member/profile-header";
import ProfileTabs from "@/components/member/profile-tabs";
import {
	breadcrumbs,
	canonical,
	NOINDEX,
	openGraphFor,
	profileStructuredData,
	SITE_NAME,
	twitterFor,
} from "@/lib/seo";
import { isPlausibleUsername } from "@/lib/username";
import { auth } from "@/server/auth";
import { recordProfileView } from "@/server/views";
import { memberProfile } from "@/trpc/cached";
import { api } from "@/trpc/server";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ username: string }>;
}): Promise<Metadata> {
	const { username } = await params;
	const typed = decodeURIComponent(username);
	const t = await getTranslations("profile");
	const locale = await getLocale();

	// Free: `memberProfile` is cached per request and the layout below calls it.
	// No session check any more — the procedure behind it is public.
	const member = await memberProfile(typed);
	if (!member) return { title: t("metaTitle", { username: typed }) };

	const title = t("metaTitle", { username: member.username });
	const description = t("metaDescription", {
		username: member.username,
		games: member.finishedGames,
	});

	return {
		title,
		description,
		/*
		 * The handle as the member spells it, not as the URL happened to be typed.
		 * Profiles resolve case-insensitively, so `/member/Ana` and `/member/ana`
		 * are one page under two addresses; naming one of them collapses the pair.
		 */
		alternates: canonical(`/member/${encodeURIComponent(member.username)}`),
		openGraph: openGraphFor({
			description,
			locale,
			title,
			url: `/member/${encodeURIComponent(member.username)}`,
		}),
		twitter: twitterFor({ description, title }),
		/*
		 * A suspended account stays reachable — a link to it should not rot — but
		 * it is not something to put in front of a search. Everyone else is
		 * indexable, which is the whole point of the profile being public.
		 */
		...(member.banned ? { robots: NOINDEX } : {}),
	};
}

/**
 * Identity and the tab strip, laid out the way chess.com does it: portrait,
 * handle and flair, whatever they have said about themselves, the line of facts
 * underneath, and the actions on the right — one button for the relationship
 * and a "…" for everything else.
 *
 * Editing any of it happens in `/settings/profile`, which is why this header
 * holds no controls of its own beyond the link there.
 *
 * The tabs are sibling routes, so switching between them re-renders only the
 * panel below; this header is resolved once and stays put.
 */
export default async function MemberLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<{ username: string }>;
}) {
	const { username } = await params;
	const handle = decodeURIComponent(username);

	// No sign-in gate: a profile is a page other people read, including people
	// who do not have an account yet. The session is still read, but only to
	// decide what may be *done* on the page.
	const session = await auth();

	// Cheap guard so a junk path segment never reaches the database.
	if (!isPlausibleUsername(handle)) notFound();

	const member = await memberProfile(handle);
	if (!member) notFound();

	const signedIn = Boolean(session?.user);
	const isSelf = session?.user?.username === member.username;

	// The button suspends on this; prefetching keeps it out of the client's
	// hands. `status` is a fact about a relationship, so it is only fetched when
	// there are two people — it stays a protected procedure.
	if (signedIn && !isSelf) {
		void api.friend.status.prefetch({ username: member.username });
	}

	/*
	 * Count the visit — after the response, so the profile is not waiting on a
	 * write nobody is reading.
	 *
	 * Three things do not count. Your own profile, because a counter you can run
	 * up yourself says nothing. A prefetch: `<Link>` renders this layout on the
	 * server when somebody so much as hovers a link to it, which would turn a
	 * mouse crossing a leaderboard into a dozen views. Next marks those requests,
	 * so they are answerable.
	 *
	 * And, now that the page is public, anyone without a session. That is the
	 * only rule a crawler cannot inflate: this profile is linked from every
	 * leaderboard row, so counting signed-out hits would mean Googlebot deciding
	 * how popular somebody is. The counter reads "members who looked at you",
	 * which is the only thing it could honestly have meant anyway.
	 */
	const prefetch = (await headers()).get("next-router-prefetch") === "1";
	if (signedIn && !isSelf && !prefetch) {
		after(() => recordProfileView(member.username));
	}

	return (
		<main className="mx-auto w-full max-w-4xl p-4">
			{/* The page's subject, for a machine. Only what the header already
				    shows — see `profileStructuredData`. */}
			<JsonLd data={profileStructuredData(member)} />
			<JsonLd
				data={breadcrumbs([
					{ name: SITE_NAME, path: "/" },
					{
						name: member.username,
						path: `/member/${encodeURIComponent(member.username)}`,
					},
				])}
			/>

			<div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
				<ProfileHeader isSelf={isSelf} member={member} signedIn={signedIn} />

				<ProfileTabs username={member.username} />
			</div>

			<section className="mt-4">{children}</section>
		</main>
	);
}
