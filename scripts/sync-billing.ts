/**
 * Re-sync every member's billing from Stripe.
 *
 * The webhook keeps the mirrors current, so this is for the cases where there
 * was no event to hear: a subscription that predates the invoice table, a
 * webhook endpoint that was down for an afternoon, or a database restored from
 * a backup taken before the last renewal.
 *
 * It calls exactly the same `syncStripeData` the webhook calls — there is no
 * second code path for repair, which is the point of having one writer.
 *
 * `--conditions=react-server` is not optional: the Stripe modules are marked
 * `server-only`, which throws under a plain Node resolver.
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx --env-file=.env scripts/sync-billing.ts
 */
import { isNotNull } from "drizzle-orm";

import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { stripeConfigured } from "@/server/stripe/client";
import { syncStripeData } from "@/server/stripe/sync";

if (!stripeConfigured) {
	console.error("Stripe is not configured — nothing to sync.");
	process.exit(1);
}

const members = await db
	.select({ username: users.username, customerId: users.stripeCustomerId })
	.from(users)
	.where(isNotNull(users.stripeCustomerId));

console.log(`syncing ${members.length} member(s) with a Stripe customer`);

let failed = 0;
for (const member of members) {
	if (!member.customerId) continue;

	try {
		const snapshot = await syncStripeData(member.customerId);
		console.log(
			`  ${member.username.padEnd(16)} ${snapshot.status}${
				snapshot.subscriptionId ? ` ${snapshot.subscriptionId}` : ""
			}`,
		);
	} catch (error) {
		failed += 1;
		console.error(
			`  ${member.username.padEnd(16)} FAILED: ${(error as Error).message}`,
		);
	}
}

console.log(failed === 0 ? "done" : `done, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
