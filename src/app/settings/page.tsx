import { redirect } from "next/navigation";

/** Settings opens on the first section, the way chess.com does. */
export default function SettingsIndex() {
	redirect("/settings/board");
}
