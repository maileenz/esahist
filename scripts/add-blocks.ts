/**
 * One-off: create the `user_block` table on a database that predates it.
 *
 * Purely additive and idempotent, so it is safe to re-run. A fresh install gets
 * the table from the schema instead (`npm run db:push`).
 *
 *   npx tsx --env-file=.env scripts/add-blocks.ts
 */
import { createPool } from "mysql2/promise";

const pool = createPool({ uri: process.env.DATABASE_URL });

await pool.query(`
	CREATE TABLE IF NOT EXISTS \`user_block\` (
		\`blocker_id\` varchar(255) NOT NULL,
		\`blocked_id\` varchar(255) NOT NULL,
		\`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
		CONSTRAINT \`user_block_blocker_id_blocked_id_pk\`
			PRIMARY KEY (\`blocker_id\`, \`blocked_id\`),
		CONSTRAINT \`user_block_blocker_id_user_id_fk\` FOREIGN KEY (\`blocker_id\`)
			REFERENCES \`user\`(\`id\`) ON DELETE CASCADE,
		CONSTRAINT \`user_block_blocked_id_user_id_fk\` FOREIGN KEY (\`blocked_id\`)
			REFERENCES \`user\`(\`id\`) ON DELETE CASCADE,
		INDEX \`user_block_blocked_idx\` (\`blocked_id\`)
	)
`);

console.log("user_block is in place");
await pool.end();
