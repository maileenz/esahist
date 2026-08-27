import type Stripe from "stripe";

import { env } from "@/env";
import { requireStripe } from "@/server/stripe/client";
import { syncStripeData } from "@/server/stripe/sync";

/**
 * Events worth waking up for.
 *
 * Every one of them means the same thing — *something about this customer's
 * billing changed* — and every one is handled the same way: re-read the
 * customer from Stripe and write the whole picture down. The list exists to
 * skip the two hundred other event types, not to branch on these.
 */
const TRACKED = new Set<Stripe.Event.Type>([
	"checkout.session.completed",
	"customer.subscription.created",
	"customer.subscription.updated",
	"customer.subscription.deleted",
	"customer.subscription.paused",
	"customer.subscription.resumed",
	"customer.subscription.pending_update_applied",
	"customer.subscription.pending_update_expired",
	"customer.subscription.trial_will_end",
	"invoice.paid",
	"invoice.payment_failed",
	"invoice.payment_action_required",
	"invoice.upcoming",
	"invoice.marked_uncollectible",
	"invoice.payment_succeeded",
	"payment_intent.succeeded",
	"payment_intent.payment_failed",
	"payment_intent.canceled",
]);

/**
 * Stripe's side of the conversation.
 *
 * The body is read as text and verified before anything else touches it: the
 * signature is over the exact bytes Stripe sent, so parsing first — or letting
 * a framework parse for you — is how you end up unable to prove an event is
 * genuine. In the App Router `req.text()` is already the raw body; there is no
 * `bodyParser` to disable.
 */
export async function POST(request: Request): Promise<Response> {
	if (!env.STRIPE_WEBHOOK_SECRET) {
		// Nothing is configured, so nothing can be verified. Refusing beats
		// pretending to have handled it.
		return new Response("Billing is not configured", { status: 501 });
	}

	const signature = request.headers.get("stripe-signature");
	if (!signature) return new Response("Missing signature", { status: 400 });

	const body = await request.text();

	let event: Stripe.Event;
	try {
		event = requireStripe().webhooks.constructEvent(
			body,
			signature,
			env.STRIPE_WEBHOOK_SECRET,
		);
	} catch (error) {
		// A bad signature is not our problem to retry — tell Stripe it was
		// rejected and let it stop.
		console.error("[stripe] rejected an event", error);
		return new Response("Invalid signature", { status: 400 });
	}

	if (!TRACKED.has(event.type)) {
		// Acknowledged and ignored: a 200 stops Stripe retrying an event we were
		// never going to act on.
		return new Response(null, { status: 200 });
	}

	const customerId = customerOf(event);
	if (!customerId) {
		console.warn(`[stripe] ${event.type} carried no customer id`);
		return new Response(null, { status: 200 });
	}

	try {
		await syncStripeData(customerId);
	} catch (error) {
		// A 500 asks Stripe to retry, which is what should happen when the
		// database or the API was briefly unavailable.
		console.error(`[stripe] failed to sync ${customerId}`, error);
		return new Response("Sync failed", { status: 500 });
	}

	return new Response(null, { status: 200 });
}

/**
 * Every tracked event carries its customer somewhere on the object. Reading it
 * generically keeps the handler from needing a branch per event type — the
 * whole point is that they are all the same instruction.
 */
function customerOf(event: Stripe.Event): string | null {
	const object = event.data.object as { customer?: string | { id: string } };
	const customer = object.customer;

	if (typeof customer === "string") return customer;
	if (customer && typeof customer === "object") return customer.id;
	return null;
}
