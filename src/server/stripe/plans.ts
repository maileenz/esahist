import "server-only";

import { env } from "@/env";

/**
 * One plan, billed monthly.
 *
 * The app never sends an amount — only a price id — so what membership costs is
 * changed in the Stripe dashboard, not in a deploy, and there is no number here
 * to disagree with the one a customer is actually charged.
 */
export function membershipPrice(): string | undefined {
	return env.STRIPE_PRICE_MONTHLY;
}

/**
 * Whether a stored price is the one currently on sale.
 *
 * `false` is not an error: it means a subscriber is grandfathered onto a price
 * that has since been retired, which is a thing Stripe lets you do on purpose.
 * The page says "Membership" for them rather than naming a plan that no longer
 * exists.
 */
export function isCurrentPrice(priceId: string | null): boolean {
	return Boolean(priceId) && priceId === env.STRIPE_PRICE_MONTHLY;
}

/**
 * Statuses that mean "this member is a member right now".
 *
 * `past_due` is deliberately in: the payment failed but Stripe is still
 * retrying, and cutting somebody off mid-retry over a card that expired is how
 * you turn a billing hiccup into a cancellation. `canceled` subscriptions keep
 * their access until the period ends, which Stripe reports as `active` with
 * `cancel_at_period_end`, so there is nothing extra to check for that.
 */
const ENTITLED = new Set(["active", "trialing", "past_due"]);

export function isEntitled(status: string): boolean {
	return ENTITLED.has(status);
}
