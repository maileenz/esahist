import type { AuthContext } from "colyseus";
import { describe, expect, it } from "vitest";

import { authenticate } from "../lib/auth";

const context = (cookie?: string) =>
	({
		headers: new Headers(cookie ? { cookie } : {}),
	}) as unknown as AuthContext;

describe("authenticate", () => {
	it("falls back to a guest when no cookie is present and anonymous play is on", async () => {
		const user = await authenticate(context());
		expect(user?.id).toMatch(/^anon-/);
	});

	it("fails closed when a session cookie cannot be resolved", async () => {
		// No DATABASE_URL in tests, so the lookup throws. A database problem must
		// never fall through to the guest path.
		const user = await authenticate(
			context("authjs.session-token=abc123; theme=dark"),
		);
		expect(user).toBeNull();
	});

	it("prefers the __Secure- cookie and ignores unrelated ones", async () => {
		const user = await authenticate(
			context(
				"theme=dark; __Secure-authjs.session-token=secure-value; authjs.session-token=plain",
			),
		);
		expect(user).toBeNull(); // resolved, then rejected — not treated as anonymous
	});

	it("ignores an oversized cookie value without querying", async () => {
		const user = await authenticate(
			context(`authjs.session-token=${"a".repeat(300)}`),
		);
		expect(user).toBeNull();
	});
});
