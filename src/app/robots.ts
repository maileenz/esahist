import type { MetadataRoute } from "next";

import { absoluteUrl, isIndexableDeployment, PRIVATE_PATHS } from "@/lib/seo";

/**
 * Resolved per request, not baked into the build.
 *
 * This is load-bearing rather than a performance choice. `next build` runs with
 * no server-side environment on purpose — the web image says so itself: "every
 * server-side value is read at run time" — so at build time `AUTH_URL` is
 * undefined. Prerendered, this file would ship as a blanket `Disallow: /` and a
 * sitemap of nothing, in production, with no error anywhere to say so. It would
 * also mean the image was domain-specific, which is the exact trap
 * `NEXT_PUBLIC_GAME_SERVER_URL` already documents.
 *
 * The cost is one render per request for a file fetched a handful of times a
 * day.
 */
export const dynamic = "force-dynamic";

/**
 * `/robots.txt`, generated rather than written by hand so it cannot name a
 * domain the deployment is not actually served on.
 *
 * Note what this file is not: it is not a way to keep anything secret. Every
 * path listed here is already behind a session check, and a disallow rule is a
 * request to a well-behaved crawler, published in public, telling everyone the
 * route exists. It is here to stop crawl budget being spent on a dozen
 * addresses that all render the same login page.
 */
export default function robots(): MetadataRoute.Robots {
	// Anything that is not the real deployment refuses everything. A staging box
	// serving a full copy of the site is the classic way to end up competing with
	// yourself in the index.
	if (!isIndexableDeployment()) {
		return { rules: [{ userAgent: "*", disallow: "/" }] };
	}

	return {
		rules: [
			{
				userAgent: "*",
				allow: "/",
				disallow: [...PRIVATE_PATHS],
			},
		],
		sitemap: absoluteUrl("/sitemap.xml"),
		// Which of the several hostnames that resolve here is the real one. Only
		// Yandex still reads it, and it costs a line.
		host: absoluteUrl("/"),
	};
}
