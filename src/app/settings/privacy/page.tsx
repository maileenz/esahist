import BlockedList from "@/components/settings/blocked-list";
import PrivacySettings from "@/components/settings/privacy-settings";
import { api, HydrateClient } from "@/trpc/server";

/**
 * Two halves, and they are stored in different places: the cookie answer lives
 * in the browser it was given in, and the block list lives on the account. Only
 * the second is worth a round trip, so only the second is prefetched.
 */
export default function PrivacySettingsPage() {
	void api.friend.blocked.prefetch(undefined);

	return (
		<HydrateClient>
			<div className="flex flex-col gap-5">
				<PrivacySettings />
				<BlockedList />
			</div>
		</HydrateClient>
	);
}
