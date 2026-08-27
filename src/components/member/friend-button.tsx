"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { confirmDestructive } from "@/lib/sweet-alert";
import { api } from "@/trpc/react";

/**
 * The one control on a profile that moves the relationship along: add, accept,
 * cancel, remove. It renders from `friend.status`, so it always reflects the
 * stored state rather than a local guess — including the case where the other
 * member asked first. The layout prefetches that query, so there is nothing to
 * wait for on arrival.
 *
 * Blocking and reporting are deliberately not here. They are not steps along
 * the same relationship, and sitting them next to "Add friend" made them look
 * like they were — the profile menu has them.
 */
export default function FriendButton({ username }: { username: string }) {
	const t = useTranslations("friends");
	const utils = api.useUtils();
	const [status] = api.friend.status.useSuspenseQuery({ username });

	function refresh() {
		void utils.friend.status.invalidate();
	}

	const request = api.friend.request.useMutation({ onSuccess: refresh });
	const respond = api.friend.respond.useMutation({ onSuccess: refresh });
	const remove = api.friend.remove.useMutation({ onSuccess: refresh });

	const busy = request.isPending || respond.isPending || remove.isPending;
	const state = status.state;

	if (state === "self") return null;

	// Blocked is a dead end by design: no friend actions until it is lifted, and
	// lifting it lives in the profile menu with the rest of the block controls.
	if (state === "blocked") {
		return (
			<span className="rounded-lg bg-elevated px-3 py-2 font-medium text-muted-foreground text-sm">
				{t("blockedState")}
			</span>
		);
	}

	async function askThenRemove() {
		const confirmed = await confirmDestructive({
			title: t("removeConfirmTitle", { username }),
			text: t("removeConfirmText"),
			confirmText: t("removeConfirm"),
		});
		if (confirmed) remove.mutate({ username });
	}

	return (
		<div className="flex items-center gap-2">
			{state === "friends" && (
				<>
					<span className="rounded-lg bg-brand-soft px-3 py-2 font-medium text-primary text-sm">
						{t("isFriend")}
					</span>
					<Button
						disabled={busy}
						onClick={askThenRemove}
						type="button"
						variant="outline"
					>
						{t("remove")}
					</Button>
				</>
			)}

			{state === "incoming" && (
				<>
					<Button
						disabled={busy}
						onClick={() => respond.mutate({ username, accept: true })}
						type="button"
					>
						{t("acceptRequest")}
					</Button>
					<Button
						disabled={busy}
						onClick={() => respond.mutate({ username, accept: false })}
						type="button"
						variant="outline"
					>
						{t("decline")}
					</Button>
				</>
			)}

			{state === "outgoing" && (
				<Button
					disabled={busy}
					onClick={() => remove.mutate({ username })}
					title={t("cancelRequestTitle")}
					type="button"
					variant="outline"
				>
					{t("requestSent")}
				</Button>
			)}

			{state === "none" && (
				<Button
					disabled={busy}
					onClick={() => request.mutate({ username })}
					type="button"
				>
					{t("add")}
				</Button>
			)}
		</div>
	);
}
