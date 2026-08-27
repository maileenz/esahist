import ProfileSettings from "@/components/settings/profile-settings";
import { api, HydrateClient } from "@/trpc/server";

export default function ProfilePage() {
	// One query holds the whole panel — every form on it reads the same row, so
	// prefetching it is the difference between three spinners and none.
	void api.settings.profile.prefetch();

	return (
		<HydrateClient>
			<ProfileSettings />
		</HydrateClient>
	);
}
