import type { AppLocale } from "@/i18n/locales";
import type messages from "../../messages/en.json";

/**
 * Makes the catalogue part of the type system.
 *
 * With this, `t("nav.play")` is checked against `messages/en.json` at compile
 * time: a typo, a renamed key or a namespace that does not exist is a build
 * error rather than a `nav.paly` printed on the page. English is the reference
 * — every other catalogue is checked against it by `scripts/check-messages.ts`.
 */
declare module "next-intl" {
	interface AppConfig {
		Locale: AppLocale;
		Messages: typeof messages;
	}
}
