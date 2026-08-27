/**
 * One-off: add `user.role` to a database that predates it.
 *
 * Everyone starts as `member`; promote yourself with `scripts/set-role.ts`.
 * Additive and safe to re-run.
 *
 *   npx tsx --env-file=.env scripts/add-roles.ts
 */
import { createPool, type RowDataPacket } from "mysql2/promise";

const pool = createPool({ uri: process.env.DATABASE_URL });

const [existing] = await pool.query<RowDataPacket[]>(
	"SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'user' AND column_name = 'role'",
);

if (existing.length > 0) {
	console.log("user.role already exists");
} else {
	await pool.query(
		"ALTER TABLE `user` ADD COLUMN `role` enum('member','admin') NOT NULL DEFAULT 'member'",
	);
	console.log("added user.role");
}

await pool.end();
