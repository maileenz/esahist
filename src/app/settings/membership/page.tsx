import MembershipSettings from "@/components/settings/membership-settings";
import { api, HydrateClient } from "@/trpc/server";

export default function MembershipPage() {
	// Prefetched so the panel has its answer before it renders: the stored
	// snapshot is the whole state, and there is nothing to wait on Stripe for.
	void api.billing.subscription.prefetch();

	return (
		<HydrateClient>
			<MembershipSettings />
		</HydrateClient>
	);
}
