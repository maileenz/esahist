import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	/**
	 * Specify your server-side environment variables schema here. This way you can ensure the app
	 * isn't built with invalid env vars.
	 *
	 * The Colyseus process (`src/server/colyseus`) cannot import this file — `@t3-oss/env-nextjs` is
	 * Next-only — so it reads `process.env` directly. Its variables are declared here anyway, with
	 * defaults, so one file describes the whole `.env`.
	 */
	server: {
		// One database for both processes. The game server reads Auth.js sessions from it.
		DATABASE_URL: z.url(),

		// Auth.js v5.
		AUTH_SECRET:
			process.env.NODE_ENV === "production"
				? z.string()
				: z.string().optional(),
		AUTH_URL: z.url().optional(),
		/** Production only: shared parent domain (".example.com") so the session cookie
        also reaches the game server on a subdomain. Leave unset locally. */
		AUTH_COOKIE_DOMAIN: z.string().optional(),
		AUTH_DISCORD_ID: z.string(),
		AUTH_DISCORD_SECRET: z.string(),
		AUTH_GITHUB_ID: z.string(),
		AUTH_GITHUB_SECRET: z.string(),
		AUTH_FACEBOOK_ID: z.string(),
		AUTH_FACEBOOK_SECRET: z.string(),
		AUTH_GOOGLE_ID: z.string(),
		AUTH_GOOGLE_SECRET: z.string(),

		// Colyseus process — read there via process.env, declared here for completeness.
		GAME_PORT: z.coerce.number().int().positive().default(2567),
		ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
		/** Skips session lookups entirely and hands out guest identities. Local only. */
		ALLOW_ANONYMOUS: z.enum(["true", "false"]).default("false"),
		/** Set a password to mount the /monitor dashboard; leave empty to disable it. */
		MONITOR_USER: z.string().optional(),
		MONITOR_PASSWORD: z.string().optional(),

		/**
		 * Stripe. The secret key and the webhook signing secret are separate
		 * secrets from separate places: the key comes from the dashboard, the
		 * signing secret from the endpoint you register (or from `stripe listen`
		 * when running locally).
		 *
		 * The price id is the whole product catalogue — membership is a price, and
		 * the app never sends an amount of its own.
		 */
		STRIPE_SECRET_KEY: z
			.string()
			.regex(/^sk_[a-z]+_.+/, "Not a Stripe secret key")
			.optional(),
		STRIPE_WEBHOOK_SECRET: z
			.string()
			.regex(/^whsec_.+/, "Not a Stripe signing secret")
			.optional(),
		// The prefix alone is not enough: `startsWith("price_")` accepts the
		// literal `price_` copied out of `.env.example`, which sails through
		// validation and then fails at Stripe with "No such price".
		STRIPE_PRICE_MONTHLY: z
			.string()
			.regex(/^price_.+/, "Not a Stripe price id")
			.optional(),

		/**
		 * UploadThing. Optional like the Stripe keys: without it the profile page
		 * simply does not offer a picture to change, rather than offering a button
		 * that fails.
		 */
		UPLOADTHING_TOKEN: z.string().min(1).optional(),

		NODE_ENV: z
			.enum(["development", "test", "production"])
			.default("development"),
	},

	/**
	 * Specify your client-side environment variables schema here. This way you can ensure the app
	 * isn't built with invalid env vars. To expose them to the client, prefix them with
	 * `NEXT_PUBLIC_`.
	 */
	client: {
		/** Where the browser reaches the Colyseus process. In production this must be a
        subdomain of the app, or the session cookie will not be sent with it. */
		NEXT_PUBLIC_GAME_SERVER_URL: z.url().default("http://localhost:2567"),
	},

	/**
	 * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
	 * middlewares) or client-side so we need to destruct manually.
	 */
	runtimeEnv: {
		DATABASE_URL: process.env.DATABASE_URL,
		AUTH_SECRET: process.env.AUTH_SECRET,
		AUTH_URL: process.env.AUTH_URL,
		AUTH_COOKIE_DOMAIN: process.env.AUTH_COOKIE_DOMAIN,
		AUTH_DISCORD_ID: process.env.AUTH_DISCORD_ID,
		AUTH_DISCORD_SECRET: process.env.AUTH_DISCORD_SECRET,
		AUTH_GITHUB_ID: process.env.AUTH_GITHUB_ID,
		AUTH_GITHUB_SECRET: process.env.AUTH_GITHUB_SECRET,
		AUTH_FACEBOOK_ID: process.env.AUTH_FACEBOOK_ID,
		AUTH_FACEBOOK_SECRET: process.env.AUTH_FACEBOOK_SECRET,
		AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
		AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
		GAME_PORT: process.env.GAME_PORT,
		ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
		ALLOW_ANONYMOUS: process.env.ALLOW_ANONYMOUS,
		MONITOR_USER: process.env.MONITOR_USER,
		MONITOR_PASSWORD: process.env.MONITOR_PASSWORD,
		STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
		STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
		STRIPE_PRICE_MONTHLY: process.env.STRIPE_PRICE_MONTHLY,
		UPLOADTHING_TOKEN: process.env.UPLOADTHING_TOKEN,
		NODE_ENV: process.env.NODE_ENV,
		NEXT_PUBLIC_GAME_SERVER_URL: process.env.NEXT_PUBLIC_GAME_SERVER_URL,
	},
	/**
	 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
	 * useful for Docker builds.
	 */
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	/**
	 * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
	 * `SOME_VAR=''` will throw an error.
	 */
	emptyStringAsUndefined: true,
});
