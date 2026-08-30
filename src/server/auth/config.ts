import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { DefaultSession, NextAuthConfig } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import FacebookProvider from "next-auth/providers/facebook";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider, { type GoogleProfile } from "next-auth/providers/google";

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
const facebook = FacebookProvider({});

/**
 * Google is the odd one out: an OIDC provider, not an OAuth one.
 *
 * The other three ship a `profile()` that turns their bespoke API response into
 * a user, and we wrap it to add our own two fields. Google ships none — Auth.js
 * reads the standard OIDC claims itself — so there is nothing to wrap and the
 * mapping below is written out in full. The four lines before `username` are
 * exactly what Auth.js would have derived on its own; they are here because
 * supplying a `profile` replaces the default rather than extending it.
 */
const google = GoogleProvider({});

const discordProfile = discord.profile;
const githubProfile = github.profile;
const facebookProfile = facebook.profile;

// Optional on the type for custom providers; the three OAuth built-ins always
// set it. Google is not in this list because OIDC providers have no `profile`
// to borrow — see the note above it.
if (!discordProfile || !githubProfile || !facebookProfile) {
	throw new Error("Expected the built-in providers to map profiles");
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
		/*
		 * Facebook. Required like the other two, so it is always registered.
		 *
		 * Its profile carries no handle of its own: Discord has `username` and
		 * GitHub has `login`, but Facebook returns a display name, so that is what
		 * the slug is built from. `slugifyUsername` turns "Ana Popescu" into
		 * `ana-popescu`, and `uniqueUsername` is what keeps the second one from
		 * colliding with the first.
		 */
		{
			...facebook,
			profile: async (...args: Parameters<typeof facebookProfile>) => {
				const user = await facebookProfile(...args);
				return {
					...user,
					username: await uniqueUsername(user.name ?? user.email ?? "player"),
					// Facebook's default field set carries no locale or country,
					// so only the request hint is used.
					country: await guessCountry(null),
				};
			},
		},

		{
			...google,
			profile: async (profile: GoogleProfile) => ({
				// What Auth.js derives by default from the OIDC claims, restated
				// because a `profile` of our own replaces that default.
				id: profile.sub,
				name: profile.name,
				email: profile.email,
				image: profile.picture,
				/*
				 * Google has no handle either — `sub` is a number nobody would want as
				 * a URL — so the slug comes from the display name, as it does for
				 * Facebook. Deliberately not the email's local part: usernames are
				 * public and indexed, and half an address is still half an address.
				 */
				username: await uniqueUsername(
					profile.name ?? profile.email ?? "player",
				),
				// Google's `locale` is a language tag like `ro` or `en-GB`, so it only
				// says anything about a country when it carries a region — the same
				// caveat as Discord's.
				country: await guessCountry(profile.locale ?? null),
			}),
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
