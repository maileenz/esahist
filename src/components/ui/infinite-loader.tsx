"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

/**
 * The parts of a React Query infinite result this needs. Structural on purpose:
 * anything that pages the same way can be handed straight in, and a call site
 * cannot wire three separate flags to the wrong query by mistake.
 */
export interface InfinitePager {
	hasNextPage: boolean;
	isFetchingNextPage: boolean;
	/** True after a failed page fetch — v5 keeps the loaded pages and flags this. */
	isFetchNextPageError?: boolean;
	fetchNextPage: () => unknown;
}

/**
 * The foot of an infinitely-scrolling list: pulls the next page in as it comes
 * into view, spins while that page is in flight, and switches itself off at the
 * end of the list.
 *
 * It is a footer rather than a wrapper, so it composes with any list markup —
 * a `<ul>`, a table body, a grid — and never has to own the scroll container.
 *
 * Three things make it safe to leave running in production:
 *
 * - The observer only exists while there is a next page to fetch and nothing is
 *   blocking it. At the end of the list there is no observer at all, so no
 *   callback can fire against a query that has nothing left to give.
 * - It is rebuilt after every page. An element that stays continuously in view
 *   emits no further entries, so a list whose pages are shorter than the
 *   viewport would otherwise load one page and stall until the reader nudged
 *   the scrollbar.
 * - A failed page stops the loop instead of retrying into it, and offers the
 *   reader a button to try again.
 */
export default function InfiniteLoader({
	query,
	disabled = false,
	rootMargin = "300px",
	endMessage,
	label,
	className = "",
}: {
	query: InfinitePager;
	/** Suspends auto-loading without unmounting — e.g. while a filter is settling. */
	disabled?: boolean;
	/** How far ahead of the viewport to start fetching. */
	rootMargin?: string;
	/** Shown once there is nothing left. Omit to render nothing at the end. */
	endMessage?: React.ReactNode;
	/** Accessible name of the manual fallback button. */
	label?: string;
	className?: string;
}) {
	const t = useTranslations("ui");
	const ref = useRef<HTMLDivElement>(null);

	// The callback reads the query through a ref so the observer does not have to
	// be rebuilt on every render just to see fresh flags. Written in an effect
	// rather than during render, and declared before the observer's, so a render
	// React discards never leaves a stale pager behind.
	const latest = useRef(query);
	useEffect(() => {
		latest.current = query;
	});

	const failed = query.isFetchNextPageError === true;
	const active = query.hasNextPage && !disabled && !failed;
	const fetching = query.isFetchingNextPage;

	// `fetching` is a deliberate dependency: re-running the effect after a
	// page lands re-tests the sentinel's position, which an element that
	// never stopped intersecting reports no new entry for.
	// biome-ignore lint/correctness/useExhaustiveDependencies: see above
	useEffect(() => {
		const node = ref.current;
		if (!node || !active) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const pager = latest.current;
				if (pager.isFetchingNextPage || !pager.hasNextPage) return;
				if (entries.some((entry) => entry.isIntersecting)) {
					void pager.fetchNextPage();
				}
			},
			{ rootMargin },
		);

		observer.observe(node);
		return () => observer.disconnect();
	}, [active, fetching, rootMargin]);

	if (!query.hasNextPage) {
		return endMessage ? (
			<p className={`py-4 text-center text-sm text-subtle ${className}`.trim()}>
				{endMessage}
			</p>
		) : null;
	}

	return (
		<div
			aria-busy={fetching}
			className={`flex min-h-14 items-center justify-center ${className}`.trim()}
			ref={ref}
		>
			{fetching ? (
				<span className="flex items-center gap-2 text-subtle" role="status">
					<Loader2
						aria-hidden
						className="h-5 w-5 animate-spin motion-reduce:hidden"
					/>
					{/* Reduced motion gets the word instead of the circle. */}
					<span className="hidden text-sm motion-reduce:inline">
						{t("loadingMore")}
					</span>
					<span className="sr-only">{t("loadingMore")}</span>
				</span>
			) : (
				<button
					className="rounded-lg border border-line px-4 py-2 font-medium text-muted-foreground text-sm transition hover:bg-elevated hover:text-fg disabled:opacity-60"
					disabled={disabled}
					onClick={() => void query.fetchNextPage()}
					type="button"
				>
					{failed ? t("loadMoreFailed") : (label ?? t("loadMore"))}
				</button>
			)}
		</div>
	);
}
