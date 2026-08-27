import BoardSettings from "@/components/settings/board-settings";
import { readAppearance } from "@/server/settings";

export default async function BoardSettingsPage() {
	// The same read the root layout used, deduped for the request — so the panel
	// opens on the values already painted on the board behind it.
	const appearance = await readAppearance();

	return <BoardSettings initial={appearance} />;
}
