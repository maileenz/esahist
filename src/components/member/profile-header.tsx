import { Pencil } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import Flag from "@/components/flag";
import Flair from "@/components/flair";
import FriendButton from "@/components/member/friend-button";
import ProfileMenu from "@/components/member/profile-menu";
import MemberAvatar from "@/components/member-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RouterOutputs } from "@/trpc/react";
import { HydrateClient } from "@/trpc/server";

type Member = NonNullable<RouterOutputs["member"]["profile"]>;

/**
 * Identity, laid out the way chess.com lays it out.
 *
 * A named-area grid rather than a row of flex children, because the pieces
 * rearrange rather than reflow: on a phone the avatar and the name share the
 * top, the facts drop underneath and the buttons go full width below them;
 * from 48em the avatar moves to the left and spans both rows, the buttons take
 * the top right, and the facts sit under the name.
 *
 *   phone            48em and up
 *   avatar  info     avatar  info     actions
 *   details          avatar  details  details
 *   actions
 *
 * The breakpoint is a container query, so it answers to the width of the card
 * this sits in rather than the width of the window — which matters here, with a
 * sidebar taking a fixed slice of the viewport out of the equation.
 */
export default async function ProfileHeader({
	member,
	isSelf,
	signedIn,
}: {
	member: Member;
	isSelf: boolean;
	/** False for a signed-out reader, who can look but not act. */
	signedIn: boolean;
}) {
	const t = await getTranslations("profile");
	const nav = await getTranslations("nav");
	return (
		<header className="@container p-5">
			<div className="grid @min-[48em]:grid-cols-[10rem_1fr_auto] grid-cols-[5rem_1fr] @min-[48em]:grid-rows-[repeat(2,auto)] grid-rows-[repeat(3,auto)] gap-4 @min-[48em]:[grid-template-areas:'avatar_info_actions'_'avatar_details_details'] [grid-template-areas:'avatar_info'_'details_details'_'actions_actions']">
				<div className="aspect-square [grid-area:avatar]">
					<MemberAvatar
						className="size-full rounded-lg"
						image={member.image}
						name={member.username}
					/>
				</div>

				<div className="min-w-0 [grid-area:info]">
					<h1 className="flex flex-wrap items-center gap-2 font-bold text-2xl text-fg">
						{member.username}
						{/* Bigger than the default: this is the one place the pair is
						    identity rather than metadata, sitting against a 24px name. */}
						<Flag
							className="shrink-0 rounded-xs text-lg"
							code={member.country}
						/>
						<Flair className="text-lg" id={member.flair} />
						{member.banned && (
							<Badge variant="destructive">{t("suspended")}</Badge>
						)}
					</h1>

					{member.name && member.name !== member.username && (
						<p className="truncate text-muted-foreground">{member.name}</p>
					)}

					{member.status && (
						<p className="wrap-break-word mt-1 text-fg text-sm">
							{member.status}
						</p>
					)}
				</div>

				{/* The line of facts: when they arrived, where they are, and how
				    often somebody has looked. What they have played is the Games
				    tab's job, and it says so with a count of its own. */}
				<div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-subtle [grid-area:details]">
					<span>
						Joined{" "}
						<span className="font-semibold text-muted-foreground">
							{formatDay(member.createdAt)}
						</span>
					</span>
					<span>
						<span className="font-semibold text-muted-foreground tabular-nums">
							{member.views}
						</span>{" "}
						{member.views === 1 ? "view" : "views"}
					</span>
					{member.location && (
						<span className="font-semibold text-muted-foreground">
							{member.location}
						</span>
					)}
				</div>

				<div className="@min-[48em]:w-auto w-full [grid-area:actions]">
					<div className="flex items-center gap-2">
						{isSelf ? (
							/* Your own profile has exactly one thing to do with it, so it is
                 a button and not the first row of a menu. */
							<Button asChild variant="outline">
								<Link href="/settings/profile">
									<Pencil aria-hidden />
									{t("editProfile")}
								</Link>
							</Button>
						) : signedIn ? (
							<>
								<HydrateClient>
									<FriendButton username={member.username} />
								</HydrateClient>
								<HydrateClient>
									<ProfileMenu
										displayName={member.username}
										username={member.username}
									/>
								</HydrateClient>
							</>
						) : (
							/*
							 * Befriending and reporting are both protected mutations, so to a
							 * signed-out reader they are buttons that can only fail. What is
							 * offered instead is the thing that would make them work — and it
							 * comes back here afterwards.
							 */
							<Button asChild>
								<Link
									href={`/login?callbackUrl=${encodeURIComponent(`/member/${member.username}`)}`}
								>
									{nav("signIn")}
								</Link>
							</Button>
						)}
					</div>
				</div>
			</div>
		</header>
	);
}

function formatDay(value: Date | string): string {
	return new Date(value).toLocaleDateString(undefined, {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}
