"use client";

import { useTranslations } from "next-intl";

import Person from "@/components/friends/person";

import { api } from "@/trpc/react";

/**
 * The requests waiting on you, or the ones you are waiting on.
 *
 * Both directions read the same `friend.pending` query, so rendering the inbox
 * above the friends list and the outbox below it still costs one request.
 *
 * Session-scoped, which is why it lives on `/friends` and not on a profile:
 * `useSuspenseQuery` has no `enabled`, so "do not fetch this for other people"
 * has to mean "do not render it".
 */
export default function PendingRequests({
	direction,
}: {
	direction: "incoming" | "outgoing";
}) {
	const t = useTranslations("friends");
	const [pending] = api.friend.pending.useSuspenseQuery();
	const people = pending[direction];

	const utils = api.useUtils();
	const refresh = () => void utils.friend.invalidate();
	const respond = api.friend.respond.useMutation({ onSuccess: refresh });
	const remove = api.friend.remove.useMutation({ onSuccess: refresh });

	if (people.length === 0) return null;

	if (direction === "outgoing") {
		return (
			<section className="rounded-xl border border-line bg-surface p-4 shadow-sm">
				<h2 className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
					{t("sent", { count: people.length })}
				</h2>
				<ul className="mt-3 space-y-2">
					{people.map((person) => (
						<li className="flex items-center gap-3" key={person.username}>
							<Person {...person} />
							<button
								className="rounded-lg border border-line px-3 py-1.5 font-medium text-muted-foreground text-sm transition hover:bg-elevated hover:text-fg"
								disabled={remove.isPending}
								onClick={() => remove.mutate({ username: person.username })}
								type="button"
							>
								{t("cancel")}
							</button>
						</li>
					))}
				</ul>
			</section>
		);
	}

	return (
		<section className="rounded-xl border border-primary bg-brand-soft p-4">
			<h2 className="font-semibold text-primary text-xs uppercase tracking-wide">
				{t("requests", { count: people.length })}
			</h2>
			<ul className="mt-3 space-y-2">
				{people.map((person) => (
					<li className="flex items-center gap-3" key={person.username}>
						<Person {...person} />
						<button
							className="rounded-lg bg-primary px-3 py-1.5 font-semibold text-primary-foreground text-sm transition hover:bg-brand-strong"
							disabled={respond.isPending}
							onClick={() =>
								respond.mutate({ username: person.username, accept: true })
							}
							type="button"
						>
							{t("accept")}
						</button>
						<button
							className="rounded-lg border border-line bg-surface px-3 py-1.5 font-medium text-fg text-sm transition hover:bg-elevated"
							disabled={respond.isPending}
							onClick={() =>
								respond.mutate({ username: person.username, accept: false })
							}
							type="button"
						>
							{t("decline")}
						</button>
					</li>
				))}
			</ul>
		</section>
	);
}
