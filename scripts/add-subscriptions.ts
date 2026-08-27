/**
 * One-off: create the `user_subscription` table on a database that predates it.
 *
 * Purely additive and idempotent, so it is safe to re-run. A fresh install gets
 * the table from the schema instead (`npm run db:push`).
 *
 * Three things, deliberately apart: the customer binding on the member's own
 * row, the subscription mirror, and the invoice mirror. Nothing is back-filled
 * — a member with no customer id has never reached for checkout, and the first
 * sync fills the invoices in.
 *
 *   npx tsx --env-file=.env scripts/add-subscriptions.ts
 */
import { createPool, type RowDataPacket } from "mysql2/promise";

const pool = createPool({ uri: process.env.DATABASE_URL });

/** The binding: which Stripe customer a member is, written once, never changed. */
const [bound] = await pool.query<RowDataPacket[]>(
	"SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'user' AND column_name = 'stripe_customer_id'",
);

if (bound.length === 0) {
	await pool.query(
		"ALTER TABLE `user` ADD COLUMN `stripe_customer_id` varchar(64) NULL",
	);
	await pool.query(
		"ALTER TABLE `user` ADD UNIQUE INDEX `user_stripe_customer_idx` (`stripe_customer_id`)",
	);
	console.log("added user.stripe_customer_id");
}

/** The mirror: Stripe's own answer, rewritten wholesale on every event. */
await pool.query(`
	CREATE TABLE IF NOT EXISTS \`user_subscription\` (
		\`user_id\` varchar(255) NOT NULL,
		\`subscription_id\` varchar(64) NULL,
		\`status\` varchar(32) NOT NULL DEFAULT 'none',
		\`price_id\` varchar(64) NULL,
		\`current_period_start\` timestamp NULL,
		\`current_period_end\` timestamp NULL,
		\`cancel_at_period_end\` boolean NOT NULL DEFAULT false,
		\`payment_brand\` varchar(32) NULL,
		\`payment_last4\` varchar(4) NULL,
		\`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		CONSTRAINT \`user_subscription_user_id_pk\` PRIMARY KEY (\`user_id\`),
		CONSTRAINT \`user_subscription_user_id_user_id_fk\` FOREIGN KEY (\`user_id\`)
			REFERENCES \`user\`(\`id\`) ON DELETE CASCADE
	)
`);

// An earlier cut of this kept the customer id on the mirror, which gave that
// table two writers. Move any bindings over before dropping it.
const [stray] = await pool.query<RowDataPacket[]>(
	"SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'user_subscription' AND column_name = 'stripe_customer_id'",
);

if (stray.length > 0) {
	await pool.query(
		"UPDATE `user` u JOIN `user_subscription` s ON s.user_id = u.id SET u.stripe_customer_id = s.stripe_customer_id WHERE u.stripe_customer_id IS NULL",
	);
	await pool.query(
		"ALTER TABLE `user_subscription` DROP COLUMN `stripe_customer_id`",
	);
	console.log("moved the customer binding onto the user row");
}

/** The invoice mirror: one row per Stripe invoice, keyed by Stripe's own id. */
await pool.query(`
	CREATE TABLE IF NOT EXISTS \`user_invoice\` (
		\`id\` varchar(64) NOT NULL,
		\`user_id\` varchar(255) NOT NULL,
		\`number\` varchar(32) NULL,
		\`status\` varchar(24) NULL,
		\`total\` int NOT NULL,
		\`currency\` varchar(8) NOT NULL,
		\`issued_at\` timestamp NOT NULL,
		\`paid_at\` timestamp NULL,
		\`hosted_url\` varchar(512) NULL,
		\`pdf_url\` varchar(512) NULL,
		\`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		CONSTRAINT \`user_invoice_pk\` PRIMARY KEY (\`id\`),
		INDEX \`user_invoice_user_idx\` (\`user_id\`, \`issued_at\`),
		CONSTRAINT \`user_invoice_user_id_user_id_fk\` FOREIGN KEY (\`user_id\`)
			REFERENCES \`user\`(\`id\`) ON DELETE CASCADE
	)
`);

console.log("billing tables are in place");
await pool.end();
process.exit(0);
