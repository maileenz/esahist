/**
 * One-off: add `user.country` to a database that predates it.
 *
 * Nullable and additive, so it needs no backfill and is safe to re-run. A fresh
 * install gets the column from the schema instead (`npm run db:push`).
 *
 *   npx tsx --env-file=.env scripts/add-country.ts
 */
import { createPool, type RowDataPacket } from "mysql2/promise";

const pool = createPool({ uri: process.env.DATABASE_URL });

const [existing] = await pool.query<RowDataPacket[]>(
	"SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'user' AND column_name = 'country'",
);

if (existing.length > 0) {
	console.log("user.country already exists");
} else {
	await pool.query("ALTER TABLE `user` ADD COLUMN `country` char(2) NULL");
	console.log("added user.country");
}

await pool.end();
