/**
 * Liveness, and only liveness.
 *
 * It answers from memory and touches nothing — no database, no game server. A
 * health check that reaches for its dependencies turns their bad minute into a
 * restart loop: the container is killed for something it cannot fix, drops the
 * requests it was serving fine, and comes back to the same outage. Whether the
 * database is reachable belongs in monitoring, where a human decides.
 */
export const dynamic = "force-dynamic";

export function GET() {
	return Response.json({ ok: true, uptime: process.uptime() });
}
