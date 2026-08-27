import { redirect } from "next/navigation";

import { auth } from "@/server/auth";
import { stripeConfigured } from "@/server/stripe/client";
import { stripeCustomerFor, syncStripeData } from "@/server/stripe/sync";

/**
 * Where checkout sends a member back to.
 *
 * It syncs before redirecting, which closes the race the whole design is built
 * around: webhooks are asynchronous, and a member who pays and immediately
 * lands back on the site would otherwise be told they are not a member. Calling
 * the same sync here means the answer is already right by the time the page
 * renders, and the webhook that arrives a second later writes the same thing.
 *
 * There is deliberately no `session_id` in the URL and nothing here reads one:
 * the customer is known from the session, and the sync is the single source of
 * truth regardless of which checkout produced it.
 */
export async function GET(): Promise<Response> {
	const session = await auth();
	if (!session?.user) redirect("/login?callbackUrl=%2Fsettings%2Fmembership");

	if (stripeConfigured) {
		try {
			await syncStripeData(await stripeCustomerFor(session.user.id));
		} catch (error) {
			// The webhook will still land it. Better to show the page and be a
			// moment behind than to show an error for a payment that worked.
			console.error("[stripe] sync after checkout failed", error);
		}
	}

	redirect("/settings/membership");
}
