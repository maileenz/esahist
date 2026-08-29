import { LogIn } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import Brand from "@/components/brand";
import MemberAvatar from "@/components/member-avatar";
import SidebarNav, { type NavItem } from "@/components/sidebar-nav";
import SidebarShell from "@/components/sidebar-shell";
import SignOutButton from "@/components/sign-out-button";
import { AppearanceButton } from "@/components/theme/appearance-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { auth, signOut } from "@/server/auth";

/**
 * The only chrome on the page: navigation, appearance, and either an account or
 * a way to make one. Stays a server component — the session is read here and the
 * drawer's open/closed state lives in `SidebarShell`, which wraps this content.
 *
 * Always rendered, signed in or not. It used to disappear for visitors, which
 * was fine while every page needed a session and became wrong the moment the
 * leaderboard, profiles, games and the lobby started rendering for strangers:
 * they arrived on a page with no brand, no navigation and no way in. What
 * changes now is the contents, not whether it exists.
 */
export default async function SiteSidebar() {
	const session = await auth();
	const t = await getTranslations("nav");
	const privacy = await getTranslations("privacy");
	const user = session?.user;

	/*
	 * What a visitor may go to, which is exactly the public routes. Friends,
	 * settings and moderation are not merely empty without an account — they
	 * redirect — and an item that bounces you to sign-in is worse than one that
	 * is not there.
	 */
	const items: NavItem[] = user?.username
		? [
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
			]
		: [
				{ href: "/", label: t("play"), icon: "play" as const },
				{
					href: "/leaderboard",
					label: t("leaderboard"),
					icon: "leaderboard" as const,
					prefixes: ["/leaderboard"],
				},
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
				{/* Appearance is a device preference, not an account one — it is the
				    one control down here that a visitor gets too. */}
				<AppearanceButton className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 font-semibold text-muted-foreground text-sm transition hover:bg-elevated hover:text-fg" />

				{/*
				 * The one permanent way to the policy. The consent bar links to it too,
				 * but that bar is gone the moment it is answered, and the settings page
				 * behind it needs an account — so without this a signed-out reader who
				 * has already dismissed the bar has no route to it at all.
				 */}
				<Link
					className="rounded-lg px-3 py-1.5 text-subtle text-xs transition hover:bg-elevated hover:text-fg"
					href="/privacy-policy"
				>
					{privacy("title")}
				</Link>

				{user?.username ? (
					<>
						<Link
							className="flex items-center gap-2 rounded-lg px-3 py-2 text-muted-foreground text-sm transition hover:bg-elevated hover:text-fg"
							href={`/member/${user.username}`}
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
					</>
				) : (
					/*
					 * The one thing a visitor is here to be offered. A filled button
					 * rather than another muted row: everything else in this rail is
					 * navigation, and this is the only thing that changes what they can
					 * do.
					 */
					<Link
						className={cn(buttonVariants({ size: "sm" }), "mt-1 w-full")}
						href="/login"
					>
						<LogIn aria-hidden className="h-4 w-4" />
						{t("signIn")}
					</Link>
				)}
			</div>
		</SidebarShell>
	);
}
