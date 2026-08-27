import "./env";

import { monitor } from "@colyseus/monitor";
import { playground } from "@colyseus/playground";
import { defineRoom, defineServer } from "colyseus";
import cors from "cors";
import basicAuth from "express-basic-auth";

import { ChessRoom } from "./rooms/ChessRoom";

const isProduction = process.env.NODE_ENV === "production";

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000")
	.split(",")
	.map((origin) => origin.trim())
	.filter(Boolean);

/**
 * Exported so the frontend can do `new Client<typeof server>(url)` and get
 * type-checked room names, join options and messages.
 */
export const server = defineServer({
	rooms: {
		chess: defineRoom(ChessRoom)
			/**
			 * Only these join options are stored for matchmaking, and a `join` /
			 * `joinOrCreate` call will only be paired with a room whose values match
			 * exactly. That is what turns `joinOrCreate("chess", ...)` into a queue
			 * per clock and rating band.
			 */
			.filterBy(["timeControl", "ranked", "ratingBucket"])
			/** Prefer a room that already has someone waiting over an empty one. */
			.sortBy({ clients: -1 })
			.on("create", (room) => console.log("[chess] room created", room.roomId))
			.on("dispose", (room) =>
				console.log("[chess] room disposed", room.roomId),
			),
	},

	express: (app) => {
		app.use(cors({ origin: allowedOrigins, credentials: true }));

		app.get("/health", (_req, res) => {
			res.json({ ok: true, uptime: process.uptime() });
		});

		if (!isProduction) {
			app.use("/playground", playground());
		}

		if (process.env.MONITOR_PASSWORD) {
			app.use(
				"/monitor",
				basicAuth({
					users: {
						[process.env.MONITOR_USER ?? "admin"]: process.env.MONITOR_PASSWORD,
					},
					challenge: true,
				}),
				monitor(),
			);
		}
	},

	/**
	 * Single process is fine to start. To run more than one node, add Redis:
	 *
	 *   presence: new RedisPresence(process.env.REDIS_URL),
	 *   driver: new RedisDriver(process.env.REDIS_URL),
	 *
	 * (both exported from `colyseus`) and put a sticky-session load balancer in
	 * front — a WebSocket must stay on the process that owns its room.
	 */
});
