import { SessionProvider } from "next-auth/react";
import { NextIntlClientProvider } from "next-intl";
import type { PropsWithChildren } from "react";
import { TRPCReactProvider } from "@/trpc/react";
import { ThemeProviders } from "./theme/theme-provider/provider";

export function Providers({ children }: PropsWithChildren) {
  return (
    <SessionProvider>
      <NextIntlClientProvider>
        <ThemeProviders>
          <TRPCReactProvider>{children}</TRPCReactProvider>
        </ThemeProviders>
      </NextIntlClientProvider>
    </SessionProvider>
  );
}
