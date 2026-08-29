import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import type Stripe from "stripe";

import { db } from "@/server/db";
import { userInvoices, userSubscriptions, users } from "@/server/db/schema";
import { requireStripe } from "./client";

export interface SubscriptionSnapshot {
	subscriptionId: string | null;
	status: string;
	priceId: string | null;
	currentPeriodStart: Date | null;
	currentPeriodEnd: Date | null;
	cancelAtPeriodEnd: boolean;
	paymentBrand: string | null;
	paymentLast4: string | null;
}

/**
 * The Stripe customer for a member, created if they do not have one yet.
 *
 * Made *before* checkout rather than by it, and remembered forever. Two things
 * depend on that: Stripe's "limit customers to one subscription" setting can
 * only work if the same customer comes back every time, and a checkout that
 * creates its own customer leaves a second one behind for the same person —
 * which is how somebody ends up paying twice and only one of the two shows up
 * in the app.
 */
export async function stripeCustomerFor(userId: string): Promise<string> {
	const [member] = await db
		.select({
			stripeCustomerId: users.stripeCustomerId,
			email: users.email,
			name: users.name,
			username: users.username,
		})
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	if (!member) throw new Error(`No such member: ${userId}`);
	if (member.stripeCustomerId) return member.stripeCustomerId;

	const customer = await requireStripe().customers.create({
		email: member.email,
		name: member.name ?? member.username,
		// The binding, written on Stripe's side too: a customer in the dashboard
		// can always be traced back to an account here, which is what makes a
		// support question answerable.
		metadata: { userId },
	});

	// `IS NULL` in the predicate is the lock: two tabs opening checkout at once
	// both create a customer at Stripe, but only the first one lands here, and
	// the read below tells the loser which id won.
	await db
		.update(users)
		.set({ stripeCustomerId: customer.id })
		.where(and(eq(users.id, userId), isNull(users.stripeCustomerId)));

	const [saved] = await db
		.select({ stripeCustomerId: users.stripeCustomerId })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	return saved?.stripeCustomerId ?? customer.id;
}

/**
 * The only function that writes billing state. Every webhook, and the return
 * from checkout, calls exactly this.
 *
 * Stripe sends 250-odd event types in an order nobody controls, and each one
 * carries a slice of the truth. Reacting to the slices means reconciling them;
 * reacting to *any* of them by re-reading the customer's current subscription
 * means there is only ever one write, and it is always the whole picture. The
 * cost is an API call per event, which is the cheapest thing here.
 */
export async function syncStripeData(
	stripeCustomerId: string,
): Promise<SubscriptionSnapshot> {
	const stripe = requireStripe();

	const subscriptions = await stripe.subscriptions.list({
		customer: stripeCustomerId,
		// Everything, newest first: a cancelled subscription still has to be
		// written down, or the app goes on believing the last active one.
		status: "all",
		limit: 1,
		expand: ["data.default_payment_method"],
	});

	const subscription = subscriptions.data[0];
	const snapshot: SubscriptionSnapshot = subscription
		? {
			subscriptionId: subscription.id,
			status: subscription.status,
			priceId: subscription.items.data[0]?.price.id ?? null,
			currentPeriodStart: periodStart(subscription),
			currentPeriodEnd: periodEnd(subscription),
			cancelAtPeriodEnd: subscription.cancel_at_period_end,
			...card(subscription.default_payment_method),
		}
		: {
			subscriptionId: null,
			status: "none",
			priceId: null,
			currentPeriodStart: null,
			currentPeriodEnd: null,
			cancelAtPeriodEnd: false,
			paymentBrand: null,
			paymentLast4: null,
		};

	const userId = await userIdFor(stripeCustomerId);

	await db
		.insert(userSubscriptions)
		.values({ userId, ...snapshot })
		.onDuplicateKeyUpdate({ set: snapshot });

	// Invoices come along on every event rather than only on `invoice.*`. It is
	// one more API call for a handful of events per member per month, and it
	// buys the property the whole design is for: after any event, everything
	// this app believes about billing is one consistent read of Stripe, with no
	// branch deciding which half got refreshed.
	await syncInvoices(stripeCustomerId, userId);

	return snapshot;
}

/** How many of the most recent invoices a sync refreshes. Older rows stay put. */
const INVOICE_WINDOW = 24;

/**
 * The invoice mirror.
 *
 * Rows are keyed by Stripe's own id, so re-syncing the same invoice overwrites
 * it — a paid invoice that is later voided ends up correct rather than twice in
 * the list. Nothing is ever deleted here: an invoice is a record of something
 * that happened, and Stripe not returning it in the recent window does not mean
 * it stopped happening.
 */
async function syncInvoices(
	stripeCustomerId: string,
	userId: string,
): Promise<void> {
	const invoices = await requireStripe().invoices.list({
		customer: stripeCustomerId,
		limit: INVOICE_WINDOW,
	});

	for (const invoice of invoices.data) {
		if (!invoice.id) continue;

		const row = {
			userId,
			number: invoice.number ?? null,
			status: invoice.status ?? null,
			total: invoice.total,
			currency: invoice.currency,
			issuedAt: new Date(invoice.created * 1000),
			paidAt: seconds(invoice.status_transitions?.paid_at),
			hostedUrl: invoice.hosted_invoice_url ?? null,
			pdfUrl: invoice.invoice_pdf ?? null,
		};

		await db
			.insert(userInvoices)
			.values({ id: invoice.id, ...row })
			.onDuplicateKeyUpdate({ set: row });
	}
}

/**
 * The customer is the key Stripe knows us by; the tables are keyed by member,
 * so an event has to be traced back. The binding written when the customer was
 * created is the usual answer; the metadata on the customer is the fallback for
 * one created outside this app — a refund issued by hand in the dashboard, say.
 */
async function userIdFor(stripeCustomerId: string): Promise<string> {
	const [row] = await db
		.select({ userId: users.id })
		.from(users)
		.where(eq(users.stripeCustomerId, stripeCustomerId))
		.limit(1);

	if (row) return row.userId;

	const customer = await requireStripe().customers.retrieve(stripeCustomerId);
	if (customer.deleted) {
		throw new Error(`Stripe customer ${stripeCustomerId} was deleted`);
	}

	const userId = customer.metadata?.userId;
	if (!userId) {
		throw new Error(
			`Stripe customer ${stripeCustomerId} has no userId in its metadata`,
		);
	}

	return userId;
}

/**
 * Where the period lives moved: it used to sit on the subscription and now sits
 * on the item. Both are read so the sync keeps working across an API version
 * bump rather than quietly writing nulls.
 */
function periodStart(subscription: Stripe.Subscription): Date | null {
	const item = subscription.items.data[0];
	return seconds(
		item?.current_period_start ??
		(subscription as unknown as { current_period_start?: number })
			.current_period_start,
	);
}

function periodEnd(subscription: Stripe.Subscription): Date | null {
	const item = subscription.items.data[0];
	return seconds(
		item?.current_period_end ??
		(subscription as unknown as { current_period_end?: number })
			.current_period_end,
	);
}

function seconds(value: number | undefined | null): Date | null {
	return typeof value === "number" ? new Date(value * 1000) : null;
}

/** Enough of the card to recognise it in the UI, and nothing more. */
function card(
	method: string | Stripe.PaymentMethod | null,
): Pick<SubscriptionSnapshot, "paymentBrand" | "paymentLast4"> {
	if (!method || typeof method === "string") {
		return { paymentBrand: null, paymentLast4: null };
	}

	return {
		paymentBrand: method.card?.brand ?? null,
		paymentLast4: method.card?.last4 ?? null,
	};
}
