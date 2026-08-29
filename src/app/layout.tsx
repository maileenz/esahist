import "@/styles/globals.css";
// Imported here rather than through globals.css: Tailwind v4 inlines `@import`
// itself, which would rebase the package's `url(../flags/…)` references against
// `src/styles/` and break every flag.
import "flag-icons/css/flag-icons.min.css";

import type { Metadata, Viewport } from "next";
import { Geist, Gluten } from "next/font/google";
import { getLocale, getTranslations } from "next-intl/server";
import NextTopLoader from "nextjs-toploader";
import ConsentBanner from "@/components/consent-banner";
import { Providers } from "@/components/providers";
import SiteSidebar from "@/components/site-sidebar";
import { Toaster } from "@/components/ui/sonner";
import {
	isIndexableDeployment,
	openGraphFor,
	SITE_NAME,
	siteOrigin,
	twitterFor,
} from "@/lib/seo";
import { readAppearance } from "@/server/settings";

// A function rather than a constant, because the description is prose and has
// to be read in the visitor's language. The title is the brand, which does not
// translate.
export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("common");
	const locale = await getLocale();
	const description = t("metaDescription");

	return {
		/*
		 * Every relative URL in every route's metadata is resolved against this —
		 * canonicals, the Open Graph card, the manifest. Without it Next resolves
		 * them against localhost and warns, and the tags ship pointing at a machine
		 * nobody can reach.
		 */
		metadataBase: new URL(siteOrigin()),

		/*
		 * The brand is a suffix, not part of any page's name, so it is written
		 * once here. Each route supplies only its own half — `metaTitle` messages
		 * used to carry "· Esahist.ro" themselves, in two languages, which meant
		 * every new page and every new locale had to remember to.
		 */
		title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
		description,
		applicationName: SITE_NAME,

		/*
		 * No `alternates` here on purpose. Metadata fields are inherited by every
		 * route that does not override them, so a canonical of "/" in the root
		 * layout would quietly tell a crawler that the leaderboard, every profile
		 * and every game are all the home page. Each route names its own.
		 */

		openGraph: openGraphFor({
			description,
			locale,
			title: SITE_NAME,
			url: "/",
		}),
		twitter: twitterFor({ description, title: SITE_NAME }),

		/*
		 * A staging box or a preview container serves the same HTML as production.
		 * The fastest way to lose the real domain's rankings is to let a copy of it
		 * get indexed, so anything that is not the real deployment says so in the
		 * page as well as in robots.txt — a crawler that reached a URL directly
		 * never asked for robots.txt.
		 */
		robots: isIndexableDeployment()
			? {
					index: true,
					follow: true,
					googleBot: {
						index: true,
						follow: true,
						"max-image-preview": "large",
						"max-snippet": -1,
						"max-video-preview": -1,
					},
				}
			: { index: false, follow: false },

		/*
		 * Declared rather than discovered. `favicon.ico` is the fallback for old
		 * browsers and for the ones that ask for `/favicon.ico` no matter what the
		 * document says; the SVG is what everything current uses, at any size, and
		 * is generated from the same artwork as the header mark by `pnpm gen:icon`.
		 */
		icons: {
			icon: [
				{ url: "/icon.svg", type: "image/svg+xml", sizes: "any" },
				{ url: "/favicon.ico", sizes: "48x48" },
			],
			apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
		},

		manifest: "/manifest.webmanifest",

		// The board is a chessboard, not a phone number. Safari decides otherwise
		// about anything that looks like a number and links it.
		formatDetection: { telephone: false, address: false, email: false },
	};
}

/**
 * The colour the browser paints its own chrome with — the address bar on
 * Android, the status bar on an installed app. Two, because the site has a
 * light and a dark side and the bar should be on the same side as the page.
 *
 * `viewport-fit=cover` is what lets the board reach the edges of a notched
 * screen; the safe-area insets are handled in CSS.
 */
export const viewport: Viewport = {
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#edebe9" },
		{ media: "(prefers-color-scheme: dark)", color: "#302e2b" },
	],
	colorScheme: "light dark",
	viewportFit: "cover",
};

const geist = Geist({
	subsets: ["latin"],
	variable: "--font-geist-sans",
});

/**
 * The wordmark's face, and nothing else's.
 *
 * Chosen for one letterform: the capital E. Two dozen rounded and display faces
 * were rasterised and their E measured for how far the left edge deviates from
 * a straight bar, and most of the obvious "rounded" ones — Fredoka, Comfortaa,
 * Baloo, Quicksand, Varela Round — turn out to draw a perfectly straight stem
 * and merely round the corners. Gluten actually bows it into a curve, which is
 * what lets the word tuck over the piece instead of colliding with it.
 */
const brandFace = Gluten({
	subsets: ["latin"],
	variable: "--font-brand-face",
	weight: ["400", "800"],
});

export default async function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	// The board is stored on the account, so the server knows it: `data-board`
	// goes into the HTML and the right squares are painted in the first frame.
	// The site theme cannot work that way — it is a device preference that only
	// the browser knows, which is why next-themes still settles it with a script.
	const appearance = await readAppearance();

	// The document has to say which language it is in, and it was saying "en"
	// while rendering Romanian. That is not cosmetic: it is what a screen reader
	// picks its pronunciation from, what a browser offers to translate against,
	// and what a crawler records as the page's language.
	const locale = await getLocale();

	return (
		// next-themes writes the theme class onto <html> before React hydrates,
		// which is a mismatch by definition — this is the documented opt-out.
		<html
			className={`${geist.variable} ${brandFace.variable}`}
			data-board={appearance.boardTheme}
			lang={locale}
			suppressHydrationWarning
		>
			<body
				className="min-h-screen bg-canvas font-sans text-fg"
				suppressHydrationWarning
			>
				<NextTopLoader color="#81b64c" shadow={false} showSpinner={false} />
				<Providers appearance={appearance}>
					{/* Column on mobile — the drawer is out of flow and its header
					    sits on top; a row from `lg`, where the rail is in flow. */}
					<div className="lg:flex lg:min-h-screen">
						<SiteSidebar />
						<div className="min-w-0 flex-1">{children}</div>
					</div>

					{/* Inside `Providers` so it can read the site theme. */}
					<Toaster position="bottom-center" />

					{/* Every page, signed in or not — the visitor who has not signed up
					    is exactly the one who has not been asked yet. */}
					<ConsentBanner />
				</Providers>
			</body>
		</html>
	);
}
