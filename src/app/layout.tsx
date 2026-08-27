import "@/styles/globals.css";
// Imported here rather than through globals.css: Tailwind v4 inlines `@import`
// itself, which would rebase the package's `url(../flags/…)` references against
// `src/styles/` and break every flag.
import "flag-icons/css/flag-icons.min.css";

import type { Metadata } from "next";
import { Geist, Gluten } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import ConsentBanner from "@/components/consent-banner";
import { Providers } from "@/components/providers";
import SiteSidebar from "@/components/site-sidebar";
import { Toaster } from "@/components/ui/sonner";
import { readAppearance } from "@/server/settings";

export const metadata: Metadata = {
	title: "Grand Master",
	description: "Play rated chess against real opponents.",
	icons: [{ rel: "icon", url: "/favicon.ico" }],
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

	return (
		// next-themes writes the theme class onto <html> before React hydrates,
		// which is a mismatch by definition — this is the documented opt-out.
		<html
			className={`${geist.variable} ${brandFace.variable}`}
			data-board={appearance.boardTheme}
			lang="en"
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
