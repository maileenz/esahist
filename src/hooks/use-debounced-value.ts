"use client";

import { useEffect, useState } from "react";

/**
 * The value, but it stops changing until the caller does.
 *
 * Typing should feel instant, while the request behind it should not fire per
 * keystroke — so a search box keeps the raw value for the input and passes the
 * debounced one to the query.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
	const [settled, setSettled] = useState(value);

	useEffect(() => {
		// An empty box should clear immediately: waiting to show everything again
		// feels broken in a way that waiting to filter does not.
		if (typeof value === "string" && value === "") {
			setSettled(value);
			return;
		}

		const id = setTimeout(() => setSettled(value), delayMs);
		return () => clearTimeout(id);
	}, [value, delayMs]);

	return settled;
}
