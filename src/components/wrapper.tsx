import NextTopLoader from "nextjs-toploader";
import type { PropsWithChildren } from "react";
import ConsentBanner from "./consent-banner";
import { Providers } from "./providers";
import { Toaster } from "./ui/sonner";

export function Wrapper({ children }: PropsWithChildren) {
	return (
		<Providers>
			<NextTopLoader
				color="var(--color-brand)"
				shadow={false}
				showSpinner={false}
			/>
			{children}

			<Toaster position="bottom-center" />
			<ConsentBanner />
		</Providers>
	);
}
