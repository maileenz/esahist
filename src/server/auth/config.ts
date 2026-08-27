import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { DefaultSession, NextAuthConfig } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import GitHubProvider from "next-auth/providers/github";

import { db } from "@/server/db";
import {
	accounts,
	sessions,
	users,
	verificationTokens,
} from "@/server/db/schema";
import { guessCountry } from "./country";
import { uniqueUsername } from "./username";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
	interface Session extends DefaultSession {
		user: {
			id: string;
			/** URL identity — `/member/<username>`. */
			username: string;
			role: "member" | "admin";
		} & DefaultSession["user"];
	}

	/** What our `profile()` mappers add on top of the provider defaults. */
	interface User {
		username?: string;
		country?: string | null;
	}
}

const isProduction = process.env.NODE_ENV === "production";
const cookieDomain = process.env.AUTH_COOKIE_DOMAIN;

/**
 * Both providers keep their own `profile()` — avatar URL rules and all — and
 * only gain a `username`, resolved to a free slug before the adapter inserts
 * the row. Replacing the mapping outright would mean owning Discord's animated
 * and default avatar rules by hand.
 */
const discord = DiscordProvider({});
const github = GitHubProvider({});

const discordProfile = discord.profile;
const githubProfile = github.profile;

// Optional on the type for custom providers; both built-ins always set it.
if (!discordProfile || !githubProfile) {
	throw new Error("Expected the Discord and GitHub providers to map profiles");
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
	providers: [
		{
			...discord,
			profile: async (...args: Parameters<typeof discordProfile>) => {
				const user = await discordProfile(...args);
				return {
					...user,
					username: await uniqueUsername(
						args[0].username ?? user.name ?? user.email ?? "player",
					),
					// `locale` is Discord's language setting, not a country — it only
					// helps when it carries a region subtag.
					country: await guessCountry(args[0].locale),
				};
			},
		},
		{
			...github,
			profile: async (...args: Parameters<typeof githubProfile>) => {
				const user = await githubProfile(...args);
				return {
					...user,
					username: await uniqueUsername(
						args[0].login ?? user.name ?? user.email ?? "player",
					),
					// GitHub's `location` is free text ("Mars", "127.0.0.1"), so it is
					// deliberately not parsed; only the request hint is used.
					country: await guessCountry(null),
				};
			},
		},
		/**
		 * ...add more providers here. Each one needs its `AUTH_<PROVIDER>_ID` and
		 * `AUTH_<PROVIDER>_SECRET` in `.env` — Auth.js v5 picks them up by name —
		 * plus a button on `/login`.
		 *
		 * GitHub can return `refresh_token_expires_in`, which our `accounts` table
		 * has no column for. Drizzle builds inserts from the table's columns rather
		 * than the object's keys, so the extra field is dropped instead of failing.
		 */
	],
	adapter: DrizzleAdapter(db, {
		usersTable: users,
		accountsTable: accounts,
		sessionsTable: sessions,
		verificationTokensTable: verificationTokens,
	}),
	pages: {
		// Our own page, so `/api/auth/signin` and every auth redirect land there
		// instead of the stock Auth.js screen. `error` shares it: the code arrives
		// as `?error=` and is rendered as a banner above the provider button.
		signIn: "/login",
		error: "/login",
	},
	callbacks: {
		session: ({ session, user }) => ({
			...session,
			user: {
				...session.user,
				id: user.id,
				// The adapter hands back the whole `user` row, but `AdapterUser`
				// does not declare our own columns — hence the cast.
				username:
					(user as typeof user & { username?: string }).username ?? user.id,
				// Database sessions re-read this row on every request, so a role
				// change takes effect on the next page load rather than the next
				// sign-in.
				role:
					(user as typeof user & { role?: "member" | "admin" }).role ??
					"member",
			},
		}),
	},
	session: {
		// Database sessions are what make the game server's job easy: the cookie
		// value is a primary key it can look up itself.
		strategy: "database",
		maxAge: 30 * 24 * 60 * 60,
	},
	cookies: {
		sessionToken: {
			name: isProduction
				? "__Secure-authjs.session-token"
				: "authjs.session-token",
			options: {
				httpOnly: true,
				// Lax, never None: subdomains count as same-site, so the game server
				// still receives the cookie while genuine cross-site sites do not.
				sameSite: "lax",
				path: "/",
				secure: isProduction,
				...(cookieDomain ? { domain: cookieDomain } : {}),
			},
		},
	},
} satisfies NextAuthConfig;
