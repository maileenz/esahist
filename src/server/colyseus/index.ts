import "./env";

import { server } from "./app.config";
import { assertAuthConfigured } from "./lib/auth";

assertAuthConfigured();

const port = Number(process.env.GAME_PORT ?? process.env.PORT ?? 2567);

server.listen(port).then(() => {
	console.log(`⚔️  chess server listening on ws://localhost:${port}`);
});

server.onBeforeShutdown(async () => {
	console.log("shutting down: draining rooms…");
});

// Colyseus registers SIGINT/SIGTERM handlers itself and waits for every room
// to dispose, so in-flight games get their `onBeforeShutdown` hook. Give your
// container a stop timeout longer than that drain (e.g. 60s in ECS/Kubernetes).
