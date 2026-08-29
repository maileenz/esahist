import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import Brand from "@/components/brand";
import JsonLd from "@/components/json-ld";
import {
	canonical,
	openGraphFor,
	siteStructuredData,
	twitterFor,
} from "@/lib/seo";
import { auth } from "@/server/auth";
import { type OAuthProvider, signInWith } from "./actions";

/**
 * The one page on this site a crawler is actually served, so it carries the
 * description as well as the title. Everything else answers a signed-out
 * request with a redirect to here.
 *
 * `?callbackUrl=` and `?error=` are the same page in every case that matters —
 * one of them is per-visitor state and the other is a transient failure — so
 * the canonical is the bare path. Without it a site with a dozen gated routes
 * ends up with a dozen indexed copies of its sign-in screen.
 */
export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("auth");
	const common = await getTranslations("common");
	const locale = await getLocale();
	const description = common("metaDescription");
	const title = t("metaTitle");

	return {
		title,
		description,
		alternates: canonical("/login"),
		// Built in full rather than patched: Next replaces the parent's `openGraph`
		// wholesale, so a partial one here loses the site name, the type and the
		// card image.
		openGraph: openGraphFor({ description, locale, title, url: "/login" }),
		twitter: twitterFor({ description, title }),
	};
}

/**
 * Registered as `pages.signIn` in the Auth.js config, so `/api/auth/signin` and
 * every unauthenticated redirect land here instead of the stock screen. Errors
 * arrive on the same route as `?error=<code>`.
 */
/**
 * The `?error=` codes Auth.js can send us. Listed rather than passed straight
 * to the catalogue: the code arrives in the query string, so it is reader input,
 * and looking up an arbitrary one would let a link put any message on the page.
 */
const ERROR_CODES = [
	"Configuration",
	"AccessDenied",
	"Verification",
	"OAuthAccountNotLinked",
	"OAuthSignin",
	"OAuthCallback",
] as const;

/** Only same-site paths — never let `?callbackUrl=` become an open redirect. */
function safeCallbackUrl(value: string | undefined): string {
	if (!value?.startsWith("/") || value.startsWith("//")) return "/";
	return value;
}

export default async function LoginPage({
	searchParams,
}: {
	searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
	const t = await getTranslations("auth");
	const privacy = await getTranslations("privacyPolicy");
	const { callbackUrl, error } = await searchParams;
	const target = safeCallbackUrl(callbackUrl);

	const session = await auth();
	if (session?.user) redirect(target);

	/*
	 * The site's own description of itself, in the vocabulary a crawler parses.
	 * It sits on the sign-in page for one reason: this is the page that gets
	 * crawled. The `@id`s inside still describe the site as a whole rather than
	 * this screen, which is what keeps the claim honest.
	 */
	const locale = await getLocale();
	const common = await getTranslations("common");

	return (
		<main className="flex min-h-[85vh] items-center justify-center p-6">
			<JsonLd data={siteStructuredData(common("metaDescription"), locale)} />
			<div className="flex w-full max-w-sm flex-col rounded-2xl border border-line bg-surface p-8 text-center shadow-sm">
				<Brand className="mb-2 self-center text-xl" />
				<p className="mt-1 text-muted-foreground text-sm">{t("tagline")}</p>

				{error && (
					<p className="mt-5 rounded-lg bg-danger-soft px-3 py-2 text-danger text-sm">
						{ERROR_CODES.includes(error as (typeof ERROR_CODES)[number])
							? t(`errors.${error as (typeof ERROR_CODES)[number]}`)
							: t("errorFallback")}
					</p>
				)}

				<div className="mt-6 flex flex-col gap-y-3">
					<ProviderForm
						callbackUrl={target}
						className="bg-[#5865F2] text-white hover:bg-[#4752c4]"
						label={t("continueWith", { provider: "Discord" })}
						provider="discord"
					>
						<DiscordIcon />
					</ProviderForm>

					<ProviderForm
						callbackUrl={target}
						className="bg-[#24292f] text-white hover:bg-[#1b1f24]"
						label={t("continueWith", { provider: "GitHub" })}
						provider="github"
					>
						<GitHubIcon />
					</ProviderForm>

					<ProviderForm
						callbackUrl={target}
						className="bg-[#1877F2] text-white hover:bg-[#0f5fd0]"
						label={t("continueWith", { provider: "Facebook" })}
						provider="facebook"
					>
						<FacebookIcon />
					</ProviderForm>
				</div>

				<p className="mt-6 text-subtle text-xs">{t("footnote")}</p>

				{/* Linked from the screen where consent is actually given, which is
				    where a sign-in provider's reviewer looks for it. */}
				<Link
					className="mt-3 text-subtle text-xs underline hover:text-fg"
					href="/privacy-policy"
				>
					{privacy("title")}
				</Link>
			</div>
		</main>
	);
}

function ProviderForm({
	provider,
	callbackUrl,
	label,
	className,
	children,
}: {
	provider: OAuthProvider;
	callbackUrl: string;
	label: string;
	className: string;
	children: React.ReactNode;
}) {
	return (
		<form action={signInWith.bind(null, provider, callbackUrl)}>
			<button
				className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-semibold text-sm transition ${className}`}
				type="submit"
			>
				{children}
				{label}
			</button>
		</form>
	);
}

function DiscordIcon() {
	return (
		<svg
			aria-hidden="true"
			className="h-5 w-5 fill-current"
			role="img"
			viewBox="0 0 24 24"
		>
			<title>Discord</title>
			<path d="M20.317 4.369A19.79 19.79 0 0 0 15.432 3c-.21.375-.455.88-.624 1.28a18.27 18.27 0 0 0-5.616 0A12.6 12.6 0 0 0 8.56 3a19.74 19.74 0 0 0-4.886 1.372C.554 9.02-.32 13.554.114 18.023a19.9 19.9 0 0 0 6.001 3.036c.484-.66.916-1.362 1.288-2.1a12.9 12.9 0 0 1-2.028-.973c.17-.124.336-.253.496-.386a14.2 14.2 0 0 0 12.258 0c.162.135.328.264.497.386-.647.38-1.328.706-2.032.975a15.7 15.7 0 0 0 1.288 2.098 19.85 19.85 0 0 0 6.003-3.036c.5-5.177-.838-9.67-3.568-13.654ZM8.02 15.278c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.955-2.42 2.157-2.42 1.21 0 2.176 1.096 2.156 2.42 0 1.334-.955 2.42-2.156 2.42Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.42 2.157-2.42 1.21 0 2.176 1.096 2.156 2.42 0 1.334-.946 2.42-2.156 2.42Z" />
		</svg>
	);
}

function FacebookIcon() {
	return (
		<svg
			aria-hidden="true"
			className="h-5 w-5 fill-current"
			role="img"
			viewBox="0 0 24 24"
		>
			<title>Facebook</title>
			<path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073Z" />
		</svg>
	);
}

function GitHubIcon() {
	return (
		<svg
			aria-hidden="true"
			className="h-5 w-5 fill-current"
			role="img"
			viewBox="0 0 24 24"
		>
			<title>GitHub</title>
			<path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23a11.5 11.5 0 0 1 3-.405c1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
		</svg>
	);
}
