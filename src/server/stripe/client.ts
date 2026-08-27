import "server-only";

import Stripe from "stripe";

import { env } from "@/env";

/**
 * Billing is optional. The keys are `.optional()` in `env.js` so the app builds
 * and runs without them — a fork that does not sell anything should not need a
 * Stripe account — and everything that needs the client asks for it through
 * `requireStripe()`, which fails loudly at the one call that needed it rather
 * than at import time.
 */
export const stripeConfigured = Boolean(
	env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_MONTHLY,
);

let client: Stripe | null = null;

export function requireStripe(): Stripe {
	if (!env.STRIPE_SECRET_KEY) {
		throw new Error(
			"STRIPE_SECRET_KEY is not set. Billing is disabled until it is.",
		);
	}

	// One instance for the process: the SDK keeps a connection pool, and a new
	// client per request throws that away.
	client ??= new Stripe(env.STRIPE_SECRET_KEY, {
		// Pinned deliberately. Stripe's API is versioned per account, and letting
		// an upgrade arrive with a library bump is how a webhook payload changes
		// shape without anybody deciding it should.
		apiVersion: "2026-07-29.dahlia",
		appInfo: { name: "Grand Master", url: "https://github.com" },
	});

	return client;
}
