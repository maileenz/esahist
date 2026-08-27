"use client";

import {
	CircleCheckIcon,
	InfoIcon,
	Loader2Icon,
	OctagonXIcon,
	TriangleAlertIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Toasts. For telling somebody what happened — never for asking them anything:
 * a choice that deletes or accepts is a SweetAlert2 dialog, which they have to
 * answer rather than watch expire.
 *
 * The theme mapping is the one edit to the registry file. Sonner knows about
 * light and dark; this site has four themes, and handing it `"midnight"` leaves
 * the toast in whatever it defaults to — which is the wrong half of the
 * palette. `resolvedTheme` only settles `system`, not our own names, so the
 * darkness of each theme is decided here.
 */
const DARK_THEMES = new Set(["dark", "midnight"]);

const Toaster = ({ ...props }: ToasterProps) => {
	const { theme, resolvedTheme } = useTheme();
	const active = theme === "system" ? resolvedTheme : theme;

	return (
		<Sonner
			className="toaster group"
			icons={{
				success: <CircleCheckIcon className="size-4" />,
				info: <InfoIcon className="size-4" />,
				warning: <TriangleAlertIcon className="size-4" />,
				error: <OctagonXIcon className="size-4" />,
				loading: <Loader2Icon className="size-4 animate-spin" />,
			}}
			style={
				{
					"--normal-bg": "var(--popover)",
					"--normal-text": "var(--popover-foreground)",
					"--normal-border": "var(--border)",
					"--border-radius": "var(--radius)",
				} as React.CSSProperties
			}
			theme={DARK_THEMES.has(active ?? "") ? "dark" : "light"}
			toastOptions={{ classNames: { toast: "cn-toast" } }}
			{...props}
		/>
	);
};

export { Toaster };
