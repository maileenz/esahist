import { LogIn } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import Brand from "@/components/brand";
import LanguageSelect from "@/components/language-select";
import MemberAvatar from "@/components/member-avatar";
import SidebarNav, { type NavItem } from "@/components/sidebar-nav";
import SidebarShell from "@/components/sidebar-shell";
import SignOutButton from "@/components/sign-out-button";
import { AppearanceButton } from "@/components/theme/appearance-dialog";
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
		<SidebarShell signedIn={Boolean(user?.username)}>
			{/* The wordmark and the one control that has to be reachable without
			    reading the interface first. */}
			<div className="flex shrink-0 items-center justify-between gap-2 px-4 py-4">
				<Link href="/">
					<Brand className="text-xl" />
				</Link>
				<LanguageSelect />
			</div>

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

				{user?.username ? (
					<>
						<Link
							className="flex items-center gap-2 rounded-lg px-3 py-2 text-muted-foreground text-sm transition hover:bg-elevated hover:text-fg"
							href={`/member/${user.username}`}
						>
							<MemberAvatar
								className="-ml-1 size-7"
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
					 * The one thing a visitor is here to be offered. Filled rather than
					 * muted like the rows above it: everything else in this rail is
					 * navigation, and this is the only thing that changes what they can
					 * do.
					 *
					 * The geometry is the rail's, not the button component's, and it is
					 * written out rather than taken from `buttonVariants` — every size
					 * that ships with the button sets its own height, padding and icon
					 * gap, so a `size="sm"` button next to these rows came out shorter
					 * with a smaller icon and its label starting at a different x. These
					 * are the same numbers `SidebarNav` and `AppearanceButton` use, so
					 * all four line up.
					 */
					<Link
						className="flex w-full items-center gap-3 rounded-lg bg-primary px-3 py-2.5 font-semibold text-primary-foreground text-sm transition hover:bg-primary/90"
						href="/login"
					>
						<LogIn aria-hidden className="h-5 w-5 shrink-0" />
						<span className="flex-1">{t("signIn")}</span>
					</Link>
				)}
			</div>
		</SidebarShell>
	);
}
