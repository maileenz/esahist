/**
 * One-off: give `user` the columns the Profile settings route writes.
 *
 * Additive and idempotent — every column is checked before it is added, so this
 * is safe to re-run. A fresh install gets them from the schema instead
 * (`npm run db:push`).
 *
 * `created_at` is the interesting one. Adding it with a default stamps every
 * existing member with the moment this script ran, which would put "Joined
 * today" on an account that has been playing for months. Where a member has
 * games, their first game is a truer lower bound on when they joined, so that
 * is what gets back-filled; members with no games keep the default, because
 * there is genuinely nothing else to go on.
 *
 *   npx tsx --env-file=.env scripts/add-profile-fields.ts
 */
import { createPool } from "mysql2/promise";

const pool = createPool({ uri: process.env.DATABASE_URL });

type Column = { name: string; definition: string };

const COLUMNS: Column[] = [
	{ name: "status", definition: "varchar(50) NULL" },
	{ name: "flair", definition: "varchar(32) NULL" },
	{ name: "location", definition: "varchar(64) NULL" },
	{ name: "views", definition: "int NOT NULL DEFAULT 0" },
	{
		name: "created_at",
		definition: "timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP",
	},
];

async function hasColumn(name: string): Promise<boolean> {
	const [rows] = await pool.query(
		`SELECT 1 FROM information_schema.columns
		 WHERE table_schema = DATABASE() AND table_name = 'user' AND column_name = ?`,
		[name],
	);

	return (rows as unknown[]).length > 0;
}

let added = 0;
let backfill = false;

for (const column of COLUMNS) {
	if (await hasColumn(column.name)) {
		console.log(`  ${column.name.padEnd(12)} already there`);
		continue;
	}

	await pool.query(
		`ALTER TABLE \`user\` ADD COLUMN \`${column.name}\` ${column.definition}`,
	);
	console.log(`  ${column.name.padEnd(12)} added`);
	added += 1;
	if (column.name === "created_at") backfill = true;
}

if (backfill) {
	// Only the rows we just defaulted, and only where a game says otherwise.
	const [result] = await pool.query(`
		UPDATE \`user\` u
		JOIN (
			SELECT player, MIN(started_at) AS first_game FROM (
				SELECT white_user_id AS player, started_at FROM \`game\`
				UNION ALL
				SELECT black_user_id AS player, started_at FROM \`game\`
			) played
			GROUP BY player
		) firsts ON firsts.player = u.id
		SET u.created_at = firsts.first_game
		WHERE firsts.first_game < u.created_at
	`);

	console.log(
		`  created_at   back-filled from first game for ${
			(result as { affectedRows: number }).affectedRows
		} member(s)`,
	);
}

console.log(added === 0 ? "nothing to do" : `${added} column(s) added`);
await pool.end();
process.exit(0);
