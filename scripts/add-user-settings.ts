/**
 * One-off: create the `user_setting` table on a database that predates it.
 *
 * Purely additive and idempotent, so it is safe to re-run. A fresh install gets
 * the table from the schema instead (`npm run db:push`).
 *
 * Nothing is back-filled: a member with no row is a member who has not changed
 * anything, which the app already reads as the defaults.
 *
 *   npx tsx --env-file=.env scripts/add-user-settings.ts
 */
import { createPool } from "mysql2/promise";

import { DEFAULT_BOARD_THEME, DEFAULT_PIECE_SET } from "@/lib/themes";

const pool = createPool({ uri: process.env.DATABASE_URL });

await pool.query(`
	CREATE TABLE IF NOT EXISTS \`user_setting\` (
		\`user_id\` varchar(255) NOT NULL,
		\`board_theme\` varchar(16) NOT NULL DEFAULT '${DEFAULT_BOARD_THEME}',
		\`piece_set\` varchar(16) NOT NULL DEFAULT '${DEFAULT_PIECE_SET}',
		\`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		CONSTRAINT \`user_setting_user_id_pk\` PRIMARY KEY (\`user_id\`),
		CONSTRAINT \`user_setting_user_id_user_id_fk\` FOREIGN KEY (\`user_id\`)
			REFERENCES \`user\`(\`id\`) ON DELETE CASCADE
	)
`);

console.log("user_setting is in place");
await pool.end();
process.exit(0);
