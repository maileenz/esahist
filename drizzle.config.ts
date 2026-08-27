import type { Config } from "drizzle-kit";

import { env } from "@/env";

export default {
	schema: "./src/server/db/schema.ts",
	dialect: "mysql",
	dbCredentials: {
		url: env.DATABASE_URL,
	},
	// No `tablesFilter`: `createTable` leaves table names unprefixed, so a filter
	// like "grand-master_*" matches nothing — drizzle-kit would read the database
	// as empty and try to CREATE tables that already exist.
} satisfies Config;
