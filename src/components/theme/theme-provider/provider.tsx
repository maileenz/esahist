import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { PropsWithChildren } from "react";

import { SITE_THEME_IDS } from "@/lib/themes";
import { readAppearance } from "@/server/settings";
import { BoardProvider } from "./context";

/**
 * The theme providers, and the one part of this folder that runs on the server.
 *
 * It lives in its own file rather than in `index.tsx` on purpose. `useBoard` is
 * imported by half a dozen client components through the folder path, and a
 * barrel that also holds this module drags `readAppearance` — and therefore
 * `next/headers` — into every one of those client bundles. Next reports that as
 * "You're importing a module that depends on next/headers … but you are using
 * it in the Pages Router", which names neither the real importer nor the real
 * import.
 *
 * So the rule for this folder is: `index.tsx` is client-safe and this file is
 * not, and only `Providers` imports this one, by its full path.
 *
 * `readAppearance` is wrapped in React's `cache`, so the root layout reading it
 * for `data-board` and this reading it for the board context cost one lookup
 * between them.
 */
export async function ThemeProviders({ children }: PropsWithChildren) {
	const appearance = await readAppearance();

	return (
		<NextThemesProvider
			attribute="class"
			defaultTheme="system"
			disableTransitionOnChange
			enableSystem
			storageKey="site-theme"
			themes={SITE_THEME_IDS}
		>
			<BoardProvider appearance={appearance}>{children}</BoardProvider>
		</NextThemesProvider>
	);
}
