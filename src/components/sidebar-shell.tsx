"use client";

import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import Brand from "@/components/brand";
import FriendRequestsBadge from "@/components/member/friend-requests-badge";

/** Tailwind's `lg`, as a media query — the width where the drawer becomes a rail. */
const DESKTOP = "(min-width: 64rem)";

/**
 * Owns the one piece of state the sidebar needs: whether the mobile drawer is
 * open. The contents stay a server component and arrive as `children`, so
 * nothing here needs the session.
 *
 * Below `lg` the rail is a drawer behind a header; from `lg` up the header is
 * gone and the rail is part of the layout, pinned to the top of the viewport
 * while the page scrolls past it.
 */
export default function SidebarShell({
	children,
}: {
	children: React.ReactNode;
}) {
	const [open, setOpen] = useState(false);
	const t = useTranslations("nav");
	const pathname = usePathname();

	const triggerRef = useRef<HTMLButtonElement>(null);
	const closeRef = useRef<HTMLButtonElement>(null);

	const close = useCallback(() => {
		setOpen(false);
		// Back to the control that opened it, rather than to the top of the page.
		triggerRef.current?.focus();
	}, []);

	// Picking a destination should not leave the drawer sitting over it.
	// `pathname` is the trigger here, not something the effect reads.
	// biome-ignore lint/correctness/useExhaustiveDependencies: see above
	useEffect(() => setOpen(false), [pathname]);

	// ...and neither should picking the destination you are already on, which
	// changes no pathname at all. Delegated, because the links are rendered in a
	// server component and cannot be handed a callback.
	const closeIfNavigating = useCallback((event: React.MouseEvent) => {
		if ((event.target as HTMLElement).closest("a")) setOpen(false);
	}, []);

	// A drawer over the page should not let the page scroll underneath it.
	useEffect(() => {
		if (!open) return;
		const previous = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = previous;
		};
	}, [open]);

	// Esc closes it, the same as every other overlay on the site.
	useEffect(() => {
		if (!open) return;
		function onKey(event: KeyboardEvent) {
			if (event.key === "Escape") close();
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, close]);

	// Growing past `lg` turns the drawer back into the rail, where "open" means
	// nothing — and leaving it set would keep the page scroll locked on a
	// desktop with no overlay in sight to explain why.
	useEffect(() => {
		const query = window.matchMedia(DESKTOP);
		const sync = () => query.matches && setOpen(false);
		sync();
		query.addEventListener("change", sync);
		return () => query.removeEventListener("change", sync);
	}, []);

	// Opening moves focus into the drawer, so the next Tab is inside it rather
	// than somewhere behind the overlay.
	useEffect(() => {
		if (open) closeRef.current?.focus();
	}, [open]);

	return (
		<>
			<header className="sticky top-0 z-30 flex items-center gap-3 border-line border-b bg-surface px-3 py-2.5 lg:hidden">
				<button
					aria-controls="site-sidebar"
					aria-expanded={open}
					aria-label={open ? t("closeMenu") : t("openMenu")}
					className="relative rounded-lg p-2 text-fg transition hover:bg-elevated"
					onClick={() => setOpen(true)}
					ref={triggerRef}
					type="button"
				>
					<Menu aria-hidden className="h-5 w-5" />
					{/* With the drawer shut there is nowhere else to show a pending
					    request, so the trigger carries the dot. */}
					<span className="absolute -top-0.5 -right-0.5">
						<FriendRequestsBadge dot />
					</span>
				</button>

				<Brand className="text-xl" />
			</header>

			{open && (
				<button
					aria-label={t("closeMenu")}
					className="fixed inset-0 z-40 bg-black/50 lg:hidden"
					onClick={close}
					tabIndex={-1}
					type="button"
				/>
			)}

			{/*
			  Closed, the drawer is `invisible` as well as pushed off-screen: a
			  translated element is still focusable, so tabbing out of the header
			  would otherwise walk through a menu nobody can see. `visibility` is
			  in the transition on purpose — it only takes effect at the end of a
			  transition to hidden, so the drawer still slides out before it goes.

			  From `lg` up it is a sticky rail: `h-screen` plus `self-start` keeps
			  it exactly one viewport tall inside the flex row instead of
			  stretching to the height of the page, which is what lets `top-0`
			  hold it in place while the page scrolls.
			*/}
			{/* Enter on a link dispatches a click, so delegation covers the keyboard
			    too — there is no separate key handler to add. */}
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: see above */}
			<aside
				className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-line border-r bg-surface transition-[transform,visibility] duration-200 lg:visible lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-56 lg:translate-x-0 lg:self-start lg:transition-none ${
					open ? "translate-x-0" : "invisible -translate-x-full"
				}`}
				id="site-sidebar"
				onClick={closeIfNavigating}
			>
				<button
					aria-label={t("closeMenu")}
					className="absolute top-3 right-3 rounded-lg p-2 text-muted-foreground transition hover:bg-elevated hover:text-fg lg:hidden"
					onClick={close}
					ref={closeRef}
					type="button"
				>
					<X aria-hidden className="h-5 w-5" />
				</button>

				{children}
			</aside>
		</>
	);
}
