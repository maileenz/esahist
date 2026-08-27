"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import Person from "@/components/friends/person";

import InfiniteLoader from "@/components/ui/infinite-loader";
import SearchInput from "@/components/ui/search-input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { api } from "@/trpc/react";

/**
 * Somebody's friends, searchable and paged.
 *
 * Takes a username rather than reading the session, because it is the same list
 * on your own page and on anybody else's — `/friends` passes your handle, a
 * profile passes whoever's profile it is.
 */
export default function FriendsList({ username }: { username: string }) {
	const t = useTranslations("friends");
	const [term, setTerm] = useState("");
	const debounced = useDebouncedValue(term);

	// What the query actually runs on. It trails `debounced` by a commit on
	// purpose: it is set inside a transition, and a transition is what lets React
	// keep the current list on screen while the suspense query for the new term
	// resolves, instead of dropping the panel to its fallback on every keystroke.
	const [search, setSearch] = useState("");
	const [switching, startTransition] = useTransition();

	useEffect(() => {
		startTransition(() => setSearch(debounced));
	}, [debounced]);

	const [data, pager] = api.friend.list.useSuspenseInfiniteQuery(
		{ username, search },
		{ getNextPageParam: (page) => page.nextCursor },
	);

	const friends = data.pages.flatMap((page) => page.items);
	const query = search.trim();
	// Someone with no friends at all gets no box to search them with — but once a
	// term is in play it has to stay, or a search with no hits would remove the
	// only way back.
	const searchable = friends.length > 0 || query !== "";

	return (
		<section className="rounded-xl border border-line bg-surface p-4 shadow-sm">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h2 className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
					{t("heading")}
				</h2>
				{searchable && (
					<SearchInput
						busy={switching}
						className="w-full sm:w-56"
						label={t("search")}
						onChange={setTerm}
						placeholder={t("search")}
						value={term}
					/>
				)}
			</div>

			{friends.length === 0 ? (
				<p className="mt-3 text-muted-foreground text-sm">
					{query ? t("noMatches", { query }) : t("empty")}
				</p>
			) : (
				<>
					<ul
						className={`mt-3 space-y-2 transition-opacity ${
							switching ? "opacity-60" : ""
						}`}
					>
						{friends.map((person) => (
							<li className="flex items-center gap-3" key={person.username}>
								<Person {...person} />
							</li>
						))}
					</ul>

					{/* Paused mid-search: the visible list belongs to the old term. */}
					<InfiniteLoader disabled={switching} query={pager} />
				</>
			)}
		</section>
	);
}
