/**
 * One-off: give every existing user a `username`, then lock the column down.
 *
 * A NOT NULL UNIQUE column cannot be added to a populated table in one
 * statement — MySQL would fill the existing rows with '' and the unique index
 * would then reject the second one. So: add it nullable, fill it, tighten it.
 *
 * Safe to re-run; every step checks the current shape of the table first.
 *
 *   npx tsx --env-file=.env scripts/add-usernames.ts
 */
import { createPool, type RowDataPacket } from "mysql2/promise";

import { slugifyUsername } from "../src/lib/username";

const pool = createPool({ uri: process.env.DATABASE_URL });

async function columnExists(name: string): Promise<boolean> {
	const [rows] = await pool.query<RowDataPacket[]>(
		"SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'user' AND column_name = ?",
		[name],
	);
	return rows.length > 0;
}

async function indexExists(name: string): Promise<boolean> {
	const [rows] = await pool.query<RowDataPacket[]>(
		"SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'user' AND index_name = ?",
		[name],
	);
	return rows.length > 0;
}

if (!(await columnExists("username"))) {
	await pool.query("ALTER TABLE `user` ADD COLUMN `username` varchar(32) NULL");
	console.log("added user.username (nullable)");
}

const [users] = await pool.query<RowDataPacket[]>(
	"SELECT id, name, email, username FROM `user`",
);

const taken = new Set(
	users
		.map((row) => row.username as string | null)
		.filter((value): value is string => Boolean(value))
		.map((value) => value.toLowerCase()),
);

for (const row of users) {
	if (row.username) continue;

	const base = slugifyUsername(
		(row.name as string | null) ??
			(row.email as string).split("@")[0] ??
			"player",
	);
	let candidate = base;
	let suffix = 2;
	while (taken.has(candidate)) {
		candidate = `${base.slice(0, 29)}-${suffix}`;
		suffix += 1;
	}
	taken.add(candidate);

	await pool.query("UPDATE `user` SET `username` = ? WHERE id = ?", [
		candidate,
		row.id,
	]);
	console.log(`${row.name ?? row.email} -> ${candidate}`);
}

await pool.query(
	"ALTER TABLE `user` MODIFY COLUMN `username` varchar(32) NOT NULL",
);

if (!(await indexExists("user_username_idx"))) {
	await pool.query(
		"CREATE UNIQUE INDEX `user_username_idx` ON `user` (`username`)",
	);
	console.log("added unique index user_username_idx");
}

console.log("done");
await pool.end();
