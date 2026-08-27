/**
 * Promote or demote a member. Deliberately a script and not an endpoint: there
 * is no way to become an admin from inside the app, so a compromised session
 * cannot grant itself moderation powers.
 *
 *   npx tsx --env-file=.env scripts/set-role.ts cmargi admin
 *   npx tsx --env-file=.env scripts/set-role.ts cmargi member
 */
import {
	createPool,
	type ResultSetHeader,
	type RowDataPacket,
} from "mysql2/promise";

const [username, role] = process.argv.slice(2);

if (!username || (role !== "admin" && role !== "member")) {
	console.error("usage: set-role.ts <username> <admin|member>");
	process.exit(1);
}

const pool = createPool({ uri: process.env.DATABASE_URL });

const [result] = await pool.query<ResultSetHeader>(
	"UPDATE `user` SET `role` = ? WHERE `username` = ?",
	[role, username.toLowerCase()],
);

if (result.affectedRows === 0) {
	console.error(`no member called "${username}"`);
	process.exit(1);
}

const [rows] = await pool.query<RowDataPacket[]>(
	"SELECT username, role FROM `user` WHERE username = ?",
	[username.toLowerCase()],
);

console.log(`${rows[0]?.username} is now ${rows[0]?.role}`);
// Sessions are database-backed: `auth()` re-reads the user row on every
// request, so a reload is enough — no need to sign out and back in.
console.log("Reload the app to pick it up.");
await pool.end();
