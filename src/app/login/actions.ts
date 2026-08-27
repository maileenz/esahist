"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";

import { signIn } from "@/server/auth";

export type OAuthProvider = "discord" | "github";

/**
 * Bound per provider by the login page. `callbackUrl` is sanitised there and
 * arrives as an encrypted bound argument, so it cannot be swapped for an
 * off-site URL on the way back.
 */
export async function signInWith(
	provider: OAuthProvider,
	callbackUrl: string,
): Promise<void> {
	try {
		await signIn(provider, { redirectTo: callbackUrl });
	} catch (err) {
		// `signIn` reports success by throwing a redirect — only a real AuthError
		// belongs back on the login page.
		if (err instanceof AuthError) {
			redirect(`/login?error=${encodeURIComponent(err.type)}`);
		}
		throw err;
	}
}
