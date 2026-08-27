"use client";

import { Play, Settings, Shield, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import OpenReportsBadge from "@/components/admin/open-reports-badge";
import FriendRequestsBadge from "@/components/member/friend-requests-badge";

/** Named rather than passed as elements: `NavItem`s are built in a server
 * component, and a React element is not serialisable across that boundary. */
const ICONS = {
	play: Play,
	friends: Users,
	leaderboard: Trophy,
	settings: Settings,
	shield: Shield,
};

export interface NavItem {
	href: string;
	label: string;
	icon: keyof typeof ICONS;
	/**
	 * Extra routes that light this item up, for a section that owns everything
	 * below one path. Data rather than a predicate, because items are built in a
	 * server component and a function cannot cross that boundary.
	 *
	 * Without it an item matches its own href exactly, which is what Play wants:
	 * `/` must not light up for every page under it.
	 */
	prefixes?: string[];
	/** A live count pill, rendered by the badge that owns that query. */
	badge?: "friendRequests" | "openReports";
}

function isActive(item: NavItem, pathname: string): boolean {
	if (pathname === item.href) return true;
	return (item.prefixes ?? []).some(
		(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
	);
}

export default function SidebarNav({ items }: { items: NavItem[] }) {
	const pathname = usePathname();
	const t = useTranslations("nav");

	return (
		<nav aria-label={t("label")} className="flex flex-col gap-1">
			{items.map((item) => {
				const active = isActive(item, pathname);
				const Icon = ICONS[item.icon];

				return (
					<Link
						aria-current={active ? "page" : undefined}
						className={`flex items-center gap-3 rounded-lg px-3 py-2.5 font-semibold text-sm transition ${
							active
								? "bg-elevated text-fg"
								: "text-muted-foreground hover:bg-elevated hover:text-fg"
						}`}
						href={item.href}
						key={item.href}
					>
						<Icon aria-hidden className="h-5 w-5 shrink-0" />
						<span className="flex-1">{item.label}</span>
						{item.badge === "friendRequests" && <FriendRequestsBadge />}
						{item.badge === "openReports" && <OpenReportsBadge />}
					</Link>
				);
			})}
		</nav>
	);
}
