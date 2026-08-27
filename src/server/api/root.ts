import { adminRouter } from "@/server/api/routers/admin";
import { billingRouter } from "@/server/api/routers/billing";
import { friendRouter } from "@/server/api/routers/friend";
import { gameRouter } from "@/server/api/routers/game";
import { leaderboardRouter } from "@/server/api/routers/leaderboard";
import { memberRouter } from "@/server/api/routers/member";
import { reportRouter } from "@/server/api/routers/report";
import { settingsRouter } from "@/server/api/routers/settings";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
	admin: adminRouter,
	billing: billingRouter,
	friend: friendRouter,
	game: gameRouter,
	leaderboard: leaderboardRouter,
	member: memberRouter,
	report: reportRouter,
	settings: settingsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.game.stats();
 */
export const createCaller = createCallerFactory(appRouter);
