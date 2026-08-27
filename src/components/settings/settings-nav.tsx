import { CreditCard, LayoutGrid, ShieldCheck, User } from "lucide-react";

import { getTranslations } from "next-intl/server";

import SettingsNavLink from "./settings-nav-link";

/**
 * The sections. A server component: the only thing here that needs the browser
 * is which row is current, and that lives in `SettingsNavLink` — so the icons
 * are rendered here and never shipped to the client at all.
 *
 * Adding a section is a route and a row.
 */
export default async function SettingsNav() {
	const t = await getTranslations("settingsNav");

	return (
		<nav
			aria-label={t("label")}
			className="shrink-0 border-line p-2 md:w-56 md:border-r"
		>
			<SettingsNavLink href="/settings/board">
				<LayoutGrid aria-hidden className="h-5 w-5 shrink-0" />
				{t("board")}
			</SettingsNavLink>

			<SettingsNavLink href="/settings/profile">
				<User aria-hidden className="h-5 w-5 shrink-0" />
				{t("profile")}
			</SettingsNavLink>

			<SettingsNavLink href="/settings/membership">
				<CreditCard aria-hidden className="h-5 w-5 shrink-0" />
				{t("membership")}
			</SettingsNavLink>

			<SettingsNavLink href="/settings/privacy">
				<ShieldCheck aria-hidden className="h-5 w-5 shrink-0" />
				{t("privacy")}
			</SettingsNavLink>
		</nav>
	);
}
