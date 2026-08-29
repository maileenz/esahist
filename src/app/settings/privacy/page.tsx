import Link from "next/link";
import { getTranslations } from "next-intl/server";

import BlockedList from "@/components/settings/blocked-list";
import PrivacySettings from "@/components/settings/privacy-settings";
import { api, HydrateClient } from "@/trpc/server";

/**
 * Two halves, and they are stored in different places: the cookie answer lives
 * in the browser it was given in, and the block list lives on the account. Only
 * the second is worth a round trip, so only the second is prefetched.
 */
export default async function PrivacySettingsPage() {
	const t = await getTranslations("privacyPolicy");

	void api.friend.blocked.prefetch(undefined);

	return (
		<HydrateClient>
			<div className="flex flex-col gap-5">
				<PrivacySettings />
				<BlockedList />

				{/* The switches above are the settings; this is the document that
				    explains what they are settings for. */}
				<Link
					className="text-muted-foreground text-sm underline underline-offset-2 hover:text-fg"
					href="/privacy-policy"
				>
					{t("title")}
				</Link>
			</div>
		</HydrateClient>
	);
}
