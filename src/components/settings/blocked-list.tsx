"use client";

import { useTranslations } from "next-intl";

import Person from "@/components/friends/person";

import { api } from "@/trpc/react";

/**
 * Who is kept away from you.
 *
 * A privacy setting rather than a friends screen: it is the opposite of a
 * friend list, nobody but you can read it, and nobody is told they are on it.
 *
 * Unlike everywhere else this list appears, an empty one still renders. On a
 * settings page the point is to say what the setting *is* and where it lives —
 * a section that vanishes when there is nothing in it is a section nobody knows
 * they have.
 */
export default function BlockedList() {
	const t = useTranslations("friends");
	const [blocked] = api.friend.blocked.useSuspenseQuery();

	const utils = api.useUtils();
	const unblock = api.friend.unblock.useMutation({
		onSuccess: () => void utils.friend.invalidate(),
	});

	return (
		<section className="border-line border-t pt-6">
			<h3 className="font-bold text-fg text-lg">
				{blocked.length > 0
					? t("blockedTitleWithCount", { count: blocked.length })
					: t("blockedTitle")}
			</h3>
			<p className="mt-1 text-muted-foreground text-sm">
				{t("blockedDescription")}
			</p>

			{blocked.length === 0 ? (
				<p className="mt-3 text-sm text-subtle">{t("blockedEmpty")}</p>
			) : (
				<ul className="mt-4 space-y-2">
					{blocked.map((person) => (
						<li className="flex items-center gap-3" key={person.username}>
							<Person {...person} />
							<button
								className="rounded-lg border border-line px-3 py-1.5 font-medium text-muted-foreground text-sm transition hover:bg-elevated hover:text-fg"
								disabled={unblock.isPending}
								onClick={() => unblock.mutate({ username: person.username })}
								type="button"
							>
								{t("unblock")}
							</button>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
