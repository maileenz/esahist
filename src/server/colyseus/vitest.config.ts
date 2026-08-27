import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["src/server/colyseus/tests/**/*.test.ts"],
		root: process.cwd(),
		// Set before any module is imported, so `auth.ts` picks it up. The empty
		// DATABASE_URL is deliberate: `app.config.ts` loads the real `.env`, and
		// dotenv never overwrites a key that is already set — this keeps the suite
		// off your development database and on the logging store.
		env: { ALLOW_ANONYMOUS: "true", NODE_ENV: "test", DATABASE_URL: "" },
		hookTimeout: 20_000,
		testTimeout: 20_000,
		fileParallelism: false,
		pool: "threads",
	},
});
