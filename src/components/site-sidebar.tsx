import Link from "next/link";
import { getTranslations } from "next-intl/server";

import Brand from "@/components/brand";
import MemberAvatar from "@/components/member-avatar";
import SidebarNav, { type NavItem } from "@/components/sidebar-nav";
import SidebarShell from "@/components/sidebar-shell";
import SignOutButton from "@/components/sign-out-button";
import { AppearanceButton } from "@/components/theme/appearance-dialog";
import { auth, signOut } from "@/server/auth";

/**
 * The only chrome on the page: navigation, appearance and sign out. Stays a
 * server component — the session is read here and the drawer's open/closed
 * state lives in `SidebarShell`, which wraps this content.
 *
 * Renders nothing when signed out, so `/login` stays a bare centred card.
 */
export default async function SiteSidebar() {
	const session = await auth();
	const t = await getTranslations("nav");
	const user = session?.user;
	if (!user?.username) return null;

	const profile = `/member/${user.username}`;

	const items: NavItem[] = [
		{ href: "/", label: t("play"), icon: "play" },
		{
			href: "/friends",
			label: t("friends"),
			icon: "friends",
			prefixes: ["/friends"],
			badge: "friendRequests",
		},
		{
			href: "/leaderboard",
			label: t("leaderboard"),
			icon: "leaderboard",
			prefixes: ["/leaderboard"],
		},
		{
			href: "/settings/board",
			label: t("settings"),
			icon: "settings",
			prefixes: ["/settings"],
		},
		...(user.role === "admin"
			? [
					{
						href: "/admin",
						label: t("moderation"),
						icon: "shield" as const,
						prefixes: ["/admin"],
						badge: "openReports" as const,
					},
				]
			: []),
	];

	return (
		<SidebarShell>
			<Link className="shrink-0 px-4 py-4" href="/">
				<Brand className="text-xl" />
			</Link>

			{/* The scrolling part. It takes whatever height is left between the
			    wordmark and the footer, so a long nav scrolls inside the rail
			    instead of pushing sign out off the bottom of the screen. */}
			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
				<SidebarNav items={items} />
			</div>

			<div className="flex shrink-0 flex-col gap-1 border-line border-t p-2">
				<AppearanceButton className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 font-semibold text-muted-foreground text-sm transition hover:bg-elevated hover:text-fg" />

				<Link
					className="flex items-center gap-2 rounded-lg px-3 py-2 text-muted-foreground text-sm transition hover:bg-elevated hover:text-fg"
					href={profile}
				>
					<MemberAvatar
						className="size-7"
						image={user.image}
						name={user.username}
					/>
					<span className="min-w-0 flex-1 truncate">{user.username}</span>
				</Link>

				<SignOutButton
					action={async () => {
						"use server";
						await signOut({ redirectTo: "/login" });
					}}
				/>
			</div>
		</SidebarShell>
	);
}
