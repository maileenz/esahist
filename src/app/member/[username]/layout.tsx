import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";

import ProfileHeader from "@/components/member/profile-header";
import ProfileTabs from "@/components/member/profile-tabs";
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
	return { title: `${decodeURIComponent(username)} · Grand Master` };
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

	const session = await auth();
	if (!session?.user) {
		redirect(`/login?callbackUrl=${encodeURIComponent(`/member/${handle}`)}`);
	}

	// Cheap guard so a junk path segment never reaches the database.
	if (!isPlausibleUsername(handle)) notFound();

	const member = await memberProfile(handle);
	if (!member) notFound();

	const isSelf = session.user.username === member.username;

	// The button suspends on this; prefetching keeps it out of the client's
	// hands. `status` is only rendered for other people, so skip it otherwise.
	if (!isSelf) void api.friend.status.prefetch({ username: member.username });

	/*
	 * Count the visit — after the response, so the profile is not waiting on a
	 * write nobody is reading.
	 *
	 * Two things do not count. Your own profile, because a counter you can run
	 * up yourself says nothing. And a prefetch: `<Link>` renders this layout on
	 * the server when somebody so much as hovers a link to it, which would turn
	 * a mouse crossing a leaderboard into a dozen views. Next marks those
	 * requests, so they are answerable.
	 */
	const prefetch = (await headers()).get("next-router-prefetch") === "1";
	if (!isSelf && !prefetch) {
		after(() => recordProfileView(member.id));
	}

	return (
		<main className="mx-auto w-full max-w-4xl p-4">
			<div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
				<ProfileHeader isSelf={isSelf} member={member} />

				<ProfileTabs username={member.username} />
			</div>

			<section className="mt-4">{children}</section>
		</main>
	);
}
