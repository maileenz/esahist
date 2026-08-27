import { SessionProvider } from "next-auth/react";
import { NextIntlClientProvider } from "next-intl";
import type { PropsWithChildren } from "react";
import type { AppearanceSettings } from "@/server/settings";
import { TRPCReactProvider } from "@/trpc/react";
import { ThemeProviders } from "./theme/theme-provider";

export function Providers({
	appearance,
	children,
}: PropsWithChildren<{ appearance: AppearanceSettings }>) {
	return (
		<SessionProvider>
			<NextIntlClientProvider>
				<ThemeProviders appearance={appearance}>
					<TRPCReactProvider>{children}</TRPCReactProvider>
				</ThemeProviders>
			</NextIntlClientProvider>
		</SessionProvider>
	);
}
