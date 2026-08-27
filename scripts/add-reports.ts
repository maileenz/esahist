/**
 * One-off: create the `user_report` table on a database that predates it.
 *
 * Purely additive and idempotent, so it is safe to re-run. A fresh install gets
 * the table from the schema instead (`npm run db:push`).
 *
 *   npx tsx --env-file=.env scripts/add-reports.ts
 */
import { createPool } from "mysql2/promise";

const pool = createPool({ uri: process.env.DATABASE_URL });

await pool.query(`
	CREATE TABLE IF NOT EXISTS \`user_report\` (
		\`id\` char(36) NOT NULL,
		\`reporter_id\` varchar(255) NOT NULL,
		\`reported_id\` varchar(255) NOT NULL,
		\`reason\` varchar(32) NOT NULL,
		\`status\` enum('open','reviewed','dismissed') NOT NULL DEFAULT 'open',
		\`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
		CONSTRAINT \`user_report_id_pk\` PRIMARY KEY (\`id\`),
		CONSTRAINT \`user_report_reporter_id_user_id_fk\` FOREIGN KEY (\`reporter_id\`)
			REFERENCES \`user\`(\`id\`) ON DELETE CASCADE,
		CONSTRAINT \`user_report_reported_id_user_id_fk\` FOREIGN KEY (\`reported_id\`)
			REFERENCES \`user\`(\`id\`) ON DELETE CASCADE,
		INDEX \`user_report_reported_idx\` (\`reported_id\`, \`status\`),
		INDEX \`user_report_reporter_idx\` (\`reporter_id\`, \`reported_id\`)
	)
`);

console.log("user_report is in place");
await pool.end();
