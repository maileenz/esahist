"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { confirmAction } from "@/lib/sweet-alert";

/**
 * The sign-out action is defined in the sidebar (a server component) and handed
 * down as a prop — server actions are passthrough-able, so the confirmation can
 * live on the client without moving the action itself.
 */
export default function SignOutButton({
	action,
}: {
	action: () => Promise<void>;
}) {
	const t = useTranslations("nav");
	const [pending, startTransition] = useTransition();

	return (
		<button
			className="flex items-center gap-3 rounded-lg px-3 py-2.5 font-semibold text-muted-foreground text-sm transition hover:bg-elevated hover:text-danger disabled:opacity-60"
			disabled={pending}
			onClick={async () => {
				const confirmed = await confirmAction({
					title: t("signOutConfirmTitle"),
					text: t("signOutConfirmText"),
					confirmText: t("signOut"),
				});
				if (confirmed) startTransition(() => void action());
			}}
			title={t("signOut")}
			type="button"
		>
			<LogOut aria-hidden className="h-5 w-5 shrink-0" />
			<span>{t("signOut")}</span>
		</button>
	);
}
