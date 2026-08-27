import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { userInvoices, userSubscriptions } from "@/server/db/schema";
import { requireStripe, stripeConfigured } from "@/server/stripe/client";
import {
	isCurrentPrice,
	isEntitled,
	membershipPrice,
} from "@/server/stripe/plans";
import { stripeCustomerFor, syncStripeData } from "@/server/stripe/sync";

/** Where Stripe sends people back to, absolute because Stripe demands it. */
function origin(headers: Headers): string {
	return (
		headers.get("origin") ?? process.env.AUTH_URL ?? "http://localhost:3000"
	);
}

export const billingRouter = createTRPCRouter({
	/**
	 * The membership page reads this. It is the stored mirror, never a live call
	 * to Stripe: the sync is what keeps it true, and a page load is not an event.
	 */
	subscription: protectedProcedure.query(async ({ ctx }) => {
		const [row] = await ctx.db
			.select()
			.from(userSubscriptions)
			.where(eq(userSubscriptions.userId, ctx.session.user.id))
			.limit(1);

		return {
			configured: stripeConfigured,
			status: row?.status ?? "none",
			// False for a subscriber grandfathered onto a retired price.
			currentPrice: isCurrentPrice(row?.priceId ?? null),
			member: isEntitled(row?.status ?? "none"),
			cancelAtPeriodEnd: row?.cancelAtPeriodEnd ?? false,
			currentPeriodEnd: row?.currentPeriodEnd ?? null,
			card:
				row?.paymentBrand && row?.paymentLast4
					? { brand: row.paymentBrand, last4: row.paymentLast4 }
					: null,
		};
	}),

	/**
	 * Starts checkout, or refuses to.
	 *
	 * One subscription per member is enforced here rather than hoped for: if the
	 * stored status says they already have one, this returns the billing portal
	 * instead — the place where changing plan is an *amendment* to the existing
	 * subscription rather than a second one alongside it. Stripe's own "limit
	 * customers to one subscription" setting is the backstop for the case where
	 * two tabs race past this check.
	 */
	checkout: protectedProcedure.mutation(async ({ ctx }) => {
		const price = membershipPrice();
		if (!stripeConfigured || !price) {
			throw new TRPCError({
				code: "PRECONDITION_FAILED",
				message: "Billing is not configured on this server.",
			});
		}

		const stripe = requireStripe();
		const customerId = await stripeCustomerFor(ctx.session.user.id);

		// Read Stripe, not the mirror: the mirror is a webhook behind, and this
		// is the check that must not be.
		const current = await syncStripeData(customerId);
		if (isEntitled(current.status)) {
			const portal = await stripe.billingPortal.sessions.create({
				customer: customerId,
				return_url: `${origin(ctx.headers)}/settings/membership`,
			});

			return { url: portal.url, alreadySubscribed: true };
		}

		const checkout = await stripe.checkout.sessions.create({
			mode: "subscription",
			// Always the customer we made: never let checkout create its own, or
			// the same member ends up behind two customer records.
			customer: customerId,
			line_items: [{ price, quantity: 1 }],
			// The return handler syncs before rendering, which is why no session
			// id is threaded through the URL.
			success_url: `${origin(ctx.headers)}/api/stripe/success`,
			cancel_url: `${origin(ctx.headers)}/settings/membership`,
			// Cards only. Wallet methods that settle asynchronously turn a
			// "subscribed" redirect into a payment that has not happened yet.
			payment_method_types: ["card"],
			allow_promotion_codes: true,
			subscription_data: { metadata: { userId: ctx.session.user.id } },
		});

		if (!checkout.url) {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Stripe did not return a checkout URL.",
			});
		}

		return { url: checkout.url, alreadySubscribed: false };
	}),

	/**
	 * Receipts, read from our own mirror.
	 *
	 * `syncStripeData` keeps this table current on every billing event, so the
	 * page costs one query and nothing at Stripe — and the history survives
	 * losing API access, which a live fetch would not.
	 */
	invoices: protectedProcedure.query(async ({ ctx }) =>
		ctx.db
			.select({
				id: userInvoices.id,
				number: userInvoices.number,
				status: userInvoices.status,
				total: userInvoices.total,
				currency: userInvoices.currency,
				issuedAt: userInvoices.issuedAt,
				hostedUrl: userInvoices.hostedUrl,
				pdfUrl: userInvoices.pdfUrl,
			})
			.from(userInvoices)
			.where(eq(userInvoices.userId, ctx.session.user.id))
			.orderBy(desc(userInvoices.issuedAt))
			.limit(24),
	),

	/**
	 * Cancel at the end of the period, never immediately: they paid for the
	 * month and should have the month. Stripe keeps reporting the subscription
	 * as active with `cancel_at_period_end` until it lapses, so entitlement
	 * needs no special case for this.
	 */
	cancel: protectedProcedure.mutation(async ({ ctx }) =>
		setRenewal(ctx.session.user.id, false),
	),

	/** Undo a cancellation, while there is still a period left to keep. */
	resume: protectedProcedure.mutation(async ({ ctx }) =>
		setRenewal(ctx.session.user.id, true),
	),

	/**
	 * The billing portal: change plan, change card, cancel. All of it is Stripe's
	 * own UI, which means none of it is a form here that could get the tax, the
	 * proration or the dunning rules wrong.
	 */
	portal: protectedProcedure.mutation(async ({ ctx }) => {
		if (!stripeConfigured) {
			throw new TRPCError({
				code: "PRECONDITION_FAILED",
				message: "Billing is not configured on this server.",
			});
		}

		const portal = await requireStripe().billingPortal.sessions.create({
			customer: await stripeCustomerFor(ctx.session.user.id),
			return_url: `${origin(ctx.headers)}/settings/membership`,
		});

		return { url: portal.url };
	}),
});

/**
 * Turns renewal on or off for whichever subscription the member has.
 *
 * The write goes to Stripe and the read comes back through `syncStripeData`,
 * so this changes nothing in our database directly — the mirror still has
 * exactly one writer, and the answer the page shows afterwards is Stripe's,
 * not a guess about what the call probably did.
 */
async function setRenewal(userId: string, renew: boolean) {
	if (!stripeConfigured) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: "Billing is not configured on this server.",
		});
	}

	const customerId = await stripeCustomerFor(userId);
	const current = await syncStripeData(customerId);

	if (!current.subscriptionId || !isEntitled(current.status)) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: "There is no active membership to change.",
		});
	}

	await requireStripe().subscriptions.update(current.subscriptionId, {
		cancel_at_period_end: !renew,
	});

	return syncStripeData(customerId);
}
