/**
 * One-off: create the `friendship` table on a database that predates it.
 *
 * Purely additive and idempotent, so it is safe to re-run. A fresh install gets
 * the table from the schema instead (`npm run db:push`).
 *
 *   npx tsx --env-file=.env scripts/add-friendships.ts
 */
import { createPool } from "mysql2/promise";

const pool = createPool({ uri: process.env.DATABASE_URL });

await pool.query(`
	CREATE TABLE IF NOT EXISTS \`friendship\` (
		\`requester_id\` varchar(255) NOT NULL,
		\`addressee_id\` varchar(255) NOT NULL,
		\`status\` enum('pending','accepted') NOT NULL DEFAULT 'pending',
		\`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
		\`responded_at\` timestamp NULL,
		CONSTRAINT \`friendship_requester_id_addressee_id_pk\`
			PRIMARY KEY (\`requester_id\`, \`addressee_id\`),
		CONSTRAINT \`friendship_requester_id_user_id_fk\` FOREIGN KEY (\`requester_id\`)
			REFERENCES \`user\`(\`id\`) ON DELETE CASCADE,
		CONSTRAINT \`friendship_addressee_id_user_id_fk\` FOREIGN KEY (\`addressee_id\`)
			REFERENCES \`user\`(\`id\`) ON DELETE CASCADE,
		INDEX \`friendship_addressee_idx\` (\`addressee_id\`, \`status\`),
		INDEX \`friendship_requester_idx\` (\`requester_id\`, \`status\`)
	)
`);

console.log("friendship is in place");
await pool.end();
