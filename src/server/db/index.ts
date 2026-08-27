import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import { createPool, type Pool } from "mysql2/promise";

import * as schema from "./schema";

/**
 * Read straight from `process.env` rather than `@/env`: this module is also
 * imported by the Colyseus process, which has no `@/*` path alias and cannot
 * load `@t3-oss/env-nextjs`. Next still validates `DATABASE_URL` — `env.js` is
 * imported by `next.config.js`.
 */
const databaseUrl = process.env.DATABASE_URL;

/**
 * Cache the database connection in development. This avoids creating a new connection on every HMR
 * update.
 */
const globalForDb = globalThis as unknown as {
	conn: Pool | undefined;
};

function connect(uri: string): Pool {
	const conn = globalForDb.conn ?? createPool({ uri });
	if (process.env.NODE_ENV !== "production") globalForDb.conn = conn;
	return conn;
}

/**
 * Without a `DATABASE_URL` the game server can still run — `ALLOW_ANONYMOUS`
 * hands out guests and the store falls back to logging (see `colyseus/lib/store.ts`),
 * which is what lets the room suite run with no database at all. Anything that
 * does reach for the database in that mode should fail loudly rather than
 * silently talk to a default connection.
 */
export const db: MySql2Database<typeof schema> = databaseUrl
	? drizzle(connect(databaseUrl), { schema, mode: "default" })
	: (new Proxy(
			{},
			{
				get() {
					throw new Error(
						"DATABASE_URL is not set — no database connection is available.",
					);
				},
			},
		) as MySql2Database<typeof schema>);
