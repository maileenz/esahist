"use client";

import Swal from "sweetalert2";

/**
 * Dialogs that follow the site's themes.
 *
 * Questions only. Anything that merely *reports* — saved, copied, sent — is a
 * sonner toast now (`toast.success(…)`), because it needs no answer and should
 * not take the page hostage until it gets one. What is left here is the set of
 * things somebody has to actually decide: resigning, blocking, cancelling,
 * suspending.
 *
 * SweetAlert2 injects its own stylesheet at runtime, usually *after* ours, so
 * plain utility classes lose the specificity race against `.swal2-popup`. The
 * `!` suffixes below are what make Light / Dark / Midnight / Parchment actually
 * apply — every colour here is a semantic token, never a fixed hex.
 */
const SHELL = {
	popup:
		"rounded-2xl! border! border-line! bg-surface! text-fg! shadow-xl! font-sans!",
	title: "text-fg! text-lg! font-semibold!",
	htmlContainer: "text-muted-foreground! text-sm!",
	actions: "gap-2!",
	cancelButton:
		"rounded-lg! border! border-line! bg-surface! px-4! py-2! text-sm! font-medium! text-fg! transition hover:bg-elevated!",
};

const ACCENT_CONFIRM =
	"rounded-lg! bg-primary! px-4! py-2! text-sm! font-semibold! text-primary-foreground! transition hover:bg-brand-strong!";
const DANGER_CONFIRM =
	"rounded-lg! bg-danger! px-4! py-2! text-sm! font-semibold! text-white! transition hover:brightness-110";

// `mixin` merges one level deep, so a child that sets `customClass` replaces the
// whole map — hence spreading SHELL into each rather than relying on the base.
const baseSwal = Swal.mixin({
	// We supply the button classes ourselves.
	buttonsStyling: false,
	// Confirm on the right, the way the rest of the app reads.
	reverseButtons: true,
	customClass: { ...SHELL, confirmButton: ACCENT_CONFIRM },
});

/** A reversible choice: joining, sending, saving. */
const confirmSwal = baseSwal.mixin({
	icon: "question",
	showCancelButton: true,
	confirmButtonText: "Confirm",
	cancelButtonText: "Cancel",
});

/**
 * A choice that loses something. Red confirm, and the cancel button takes focus
 * so a stray Enter dismisses rather than destroys.
 */
const destructiveSwal = baseSwal.mixin({
	icon: "warning",
	showCancelButton: true,
	focusCancel: true,
	confirmButtonText: "Yes, do it",
	cancelButtonText: "Cancel",
	customClass: { ...SHELL, confirmButton: DANGER_CONFIRM },
});

interface AskOptions {
	title: string;
	text?: string;
	confirmText?: string;
	cancelText?: string;
}

/** `true` if they went through with it. Nothing else to unpack at call sites. */
export async function confirmAction({
	title,
	text,
	confirmText = "Confirm",
	cancelText = "Cancel",
}: AskOptions): Promise<boolean> {
	const result = await confirmSwal.fire({
		title,
		text,
		confirmButtonText: confirmText,
		cancelButtonText: cancelText,
	});
	return result.isConfirmed;
}

/** Same, for anything that deletes, resigns or cuts someone off. */
export async function confirmDestructive({
	title,
	text,
	confirmText = "Yes, do it",
	cancelText = "Cancel",
}: AskOptions): Promise<boolean> {
	const result = await destructiveSwal.fire({
		title,
		text,
		confirmButtonText: confirmText,
		cancelButtonText: cancelText,
	});
	return result.isConfirmed;
}
