"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

/**
 * Sibling routes rather than client state, so each tab is linkable and gets its
 * own server-prefetched data. Underlined rather than pill-shaped, which is what
 * lets the strip sit flush along the bottom of the header card.
 */
export default function ProfileTabs({ username }: { username: string }) {
	const t = useTranslations("profile");
	const pathname = usePathname();
	const base = `/member/${username}`;

	const tabs = [
		{ href: base, label: t("overview"), exact: true },
		{ href: `${base}/games`, label: t("games"), exact: false },
		{ href: `${base}/friends`, label: t("friends"), exact: false },
	];

	return (
		// `overflow-x-auto` alone would compute `overflow-y` to `auto` as well,
		// which a one-pixel-tall overflow is enough to turn into a real scrollbar.
		<nav className="flex gap-1 overflow-x-auto overflow-y-hidden border-line border-t px-3">
			{tabs.map((tab) => {
				// Overview is the index route, so it matches exactly or every tab
				// would light up at once.
				const active = tab.exact
					? pathname === tab.href
					: pathname === tab.href || pathname.startsWith(`${tab.href}/`);

				return (
					<Link
						aria-current={active ? "page" : undefined}
						className={`border-b-2 px-3 py-3 font-semibold text-sm transition ${
							active
								? "border-primary text-fg"
								: "border-transparent text-muted-foreground hover:text-fg"
						}`}
						href={tab.href}
						key={tab.href}
					>
						{tab.label}
					</Link>
				);
			})}
		</nav>
	);
}
