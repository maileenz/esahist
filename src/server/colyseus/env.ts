import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";

/**
 * Must be the first import of the process: ES module imports are evaluated in
 * order, so loading env here guarantees every other module sees the values.
 * Shares one env file with Next.js — DATABASE_URL is the same connection.
 *
 * Paths are resolved against the working directory (the project root) rather
 * than the module, so the bundled build in `.game-build/` reads the same files.
 */
const files = [".env.local", ".env"]
	.map((file) => resolve(process.cwd(), file))
	.filter((file) => existsSync(file));

if (files.length > 0) {
	loadEnv({ path: files, quiet: true });
}
