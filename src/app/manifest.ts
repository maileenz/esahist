import type { MetadataRoute } from "next";
import { getTranslations } from "next-intl/server";

import { SITE_NAME } from "@/lib/seo";

/**
 * The web app manifest, at `/manifest.webmanifest`.
 *
 * Not a search ranking factor, and not pretending to be one. It is what decides
 * whether "Add to home screen" produces something with the site's name and mark
 * on it or a screenshot labelled with the URL — and it is what a link preview
 * and an app listing read the short name from.
 *
 * `getTranslations` rather than a constant description: this is prose, and the
 * manifest is fetched with the reader's cookies, so it can be in their language.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
	const t = await getTranslations("common");

	return {
		name: SITE_NAME,
		// What fits under an icon. The TLD is part of the wordmark, not part of a
		// twelve-character label.
		short_name: "Esahist",
		description: t("metaDescription"),
		start_url: "/",
		display: "standalone",
		// The canvas, so the launch screen is not a white flash before the board.
		background_color: "#edebe9",
		theme_color: "#81b64c",
		orientation: "any",
		categories: ["games", "entertainment"],
		// Both live in `public/` and are served at exactly these paths. An
		// `app/icon.*` file would be served under a content-hashed URL instead,
		// which a hand-written manifest entry cannot name.
		icons: [
			// Vector, so one file covers every size a launcher asks for. Listed
			// twice because a manifest entry carries one purpose: the same artwork
			// is also the maskable one, since `generate-icon.ts` insets the piece
			// into the middle 80% — a launcher that masks icons into a circle then
			// crops padding rather than the pawn.
			{
				src: "/icon.svg",
				type: "image/svg+xml",
				sizes: "any",
				purpose: "any",
			},
			{
				src: "/icon.svg",
				type: "image/svg+xml",
				sizes: "any",
				purpose: "maskable",
			},
			{ src: "/favicon.ico", type: "image/x-icon", sizes: "48x48" },
		],
	};
}
