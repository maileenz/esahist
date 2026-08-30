"use client";

import { Settings2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { SITE_THEMES } from "@/lib/themes";
import { cn } from "@/lib/utils";

const SYSTEM = "system";

/**
 * Opens the appearance dialog. Rendered in the header as an icon and in the
 * lobby panel as a row — same dialog, two entry points, no shared state to keep
 * in sync because each trigger owns its own.
 *
 * The site palette only. The board and its pieces are stored on the account
 * rather than in this browser, so they live in Settings with everything else
 * that follows a member between devices.
 */
export function AppearanceButton({ className }: { className?: string }) {
	const t = useTranslations("appearance");
	const themes = useTranslations("appearance.themes");
	const nav = useTranslations("nav");
	const { theme, setTheme } = useTheme();
	const mounted = useMounted();

	// next-themes only knows the stored theme after mount; until then nothing is
	// marked active rather than the wrong thing being marked active.
	const active = mounted ? (theme ?? SYSTEM) : null;

	return (
		<Dialog>
			<DialogTrigger asChild>
				{className ? (
					<button
						aria-label={nav("appearanceLabel")}
						className={className}
						type="button"
					>
						{/* `h-5 w-5`, matching `SidebarNav`'s icons: this branch is only
						    ever the row in the rail, and at 16px its label started four
						    pixels left of every other row's. */}
						<Settings2 aria-hidden className="h-5 w-5 shrink-0" />
						{nav("appearance")}
					</button>
				) : (
					<Button aria-label={nav("appearanceLabel")} variant="outline">
						<Settings2 aria-hidden />
						<span className="hidden sm:inline">{nav("appearance")}</span>
					</Button>
				)}
			</DialogTrigger>

			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{t("title")}</DialogTitle>
				</DialogHeader>

				<section>
					<h3 className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
						{t("theme")}
					</h3>

					<div className="mt-2 grid grid-cols-3 gap-2">
						<OptionCard
							active={active === SYSTEM}
							onClick={() => setTheme(SYSTEM)}
						>
							<span className="h-8 w-8 rounded-full border border-line bg-linear-to-br from-white to-neutral-900" />
							{t("system")}
						</OptionCard>

						{SITE_THEMES.map((entry) => (
							<OptionCard
								active={active === entry.id}
								key={entry.id}
								onClick={() => setTheme(entry.id)}
							>
								<span className="flex h-8 w-8 overflow-hidden rounded-full ring-1 ring-black/10">
									<span
										className="w-1/2"
										style={{ backgroundColor: entry.swatch[0] }}
									/>
									<span
										className="w-1/2"
										style={{ backgroundColor: entry.swatch[1] }}
									/>
								</span>
								{themes(entry.id)}
							</OptionCard>
						))}
					</div>
				</section>

				<DialogFooter>
					{/* `DialogClose` rather than an onClick: the dialog owns its own
					    open state now, and nothing else needs to know about it. */}
					<DialogClose asChild>
						<Button type="button">{t("done")}</Button>
					</DialogClose>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function OptionCard({
	active,
	onClick,
	children,
	disabled = false,
}: {
	disabled?: boolean;
	active: boolean | null;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			aria-pressed={active ?? false}
			className={cn(
				"flex flex-col items-center gap-2 rounded-lg border p-3 text-fg text-xs transition disabled:opacity-60",
				active
					? "border-primary bg-brand-soft"
					: "border-line hover:bg-elevated",
			)}
			disabled={disabled}
			onClick={onClick}
			type="button"
		>
			{children}
		</button>
	);
}

/** next-themes only knows the stored theme after mount. */
function useMounted(): boolean {
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	return mounted;
}
