"use client";

import { Loader2, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef } from "react";

import { Input } from "@/components/ui/input";

/**
 * A search box, controlled by the caller.
 *
 * Deliberately not debounced in here: the input must repaint on every keystroke
 * or typing feels broken. Pair it with `useDebouncedValue` and give the query
 * the settled value — the two concerns stay separate and both stay reusable.
 */
export default function SearchInput({
	value,
	onChange,
	placeholder,
	label,
	busy = false,
	autoFocus = false,
	className = "",
}: {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	/** Names the field for screen readers; visually hidden. */
	label: string;
	/** Shows a spinner in place of the clear button while a query is in flight. */
	busy?: boolean;
	autoFocus?: boolean;
	className?: string;
}) {
	const t = useTranslations("ui");
	const id = useId();
	const inputRef = useRef<HTMLInputElement>(null);

	return (
		<div className={`relative ${className}`.trim()}>
			<label className="sr-only" htmlFor={id}>
				{label}
			</label>

			<Search
				aria-hidden
				className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle"
			/>

			<Input
				autoComplete="off"
				// Opt-in, and only where the box is the point of the view. (The
				// a11y rule does not reach through a component, so there is no
				// suppression to keep here.)
				autoFocus={autoFocus}
				// WebKit draws its own clear button on a search input; ours is the one
				// with the accessible name, so the native one is turned off.
				className="pr-9 pl-9 [&::-webkit-search-cancel-button]:appearance-none"
				id={id}
				onChange={(event) => onChange(event.target.value)}
				onKeyDown={(event) => {
					// Escape clears rather than blurring — the browser default on a
					// search input varies, and clearing is what people expect here.
					if (event.key === "Escape" && value) {
						event.preventDefault();
						onChange("");
					}
				}}
				placeholder={placeholder}
				ref={inputRef}
				// `search` gets the on-screen keyboard a search key on mobile.
				type="search"
				value={value}
			/>

			{busy ? (
				<Loader2
					aria-hidden
					className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-subtle"
				/>
			) : (
				value && (
					<button
						aria-label={t("clearSearch")}
						className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-subtle transition hover:bg-elevated hover:text-fg"
						onClick={() => {
							onChange("");
							inputRef.current?.focus();
						}}
						type="button"
					>
						<X aria-hidden className="h-4 w-4" />
					</button>
				)
			)}
		</div>
	);
}
