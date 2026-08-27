"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * One row of the settings rail, and the only part of it that needs the browser.
 *
 * `usePathname` is the whole reason this is a client component — everything
 * else about the rail is static markup. Keeping it to this one link lets the
 * nav around it stay on the server, which is also why the icon arrives as
 * `children`: a component *reference* cannot cross that boundary, but an
 * already-rendered element can.
 */
export default function SettingsNavLink({
	href,
	children,
}: {
	href: string;
	children: React.ReactNode;
}) {
	const pathname = usePathname();
	const active = pathname === href || pathname.startsWith(`${href}/`);

	return (
		<Link
			aria-current={active ? "page" : undefined}
			className={`flex items-center gap-3 rounded-lg px-3 py-2.5 font-semibold text-sm transition ${
				active
					? "bg-elevated text-fg"
					: "text-muted-foreground hover:bg-elevated hover:text-fg"
			}`}
			href={href}
		>
			{children}
		</Link>
	);
}
