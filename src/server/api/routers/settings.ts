import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { env } from "@/env";
import { flairNeedsMembership } from "@/lib/flairs";
import {
	detailsInput,
	flairInput,
	orNull,
	publicProfileInput,
} from "@/lib/profile";
import {
	BOARD_THEME_IDS,
	DEFAULT_BOARD_THEME,
	DEFAULT_PIECE_SET,
	PIECE_SET_IDS,
} from "@/lib/themes";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { userSettings, userSubscriptions, users } from "@/server/db/schema";
import { isEntitled } from "@/server/stripe/plans";

/**
 * Whitelists, not free text: a stored id that no longer names anything would
 * paint a board with no colours, and these two columns are the only thing
 * standing between a form post and the stylesheet.
 */
const appearanceInput = z.object({
	boardTheme: z.enum(BOARD_THEME_IDS as [string, ...string[]]),
	pieceSet: z.enum(PIECE_SET_IDS as [string, ...string[]]),
});

/** A member's own preferences. Everything here is scoped to the session. */
export const settingsRouter = createTRPCRouter({
	appearance: protectedProcedure.query(async ({ ctx }) => {
		const [row] = await ctx.db
			.select({
				boardTheme: userSettings.boardTheme,
				pieceSet: userSettings.pieceSet,
			})
			.from(userSettings)
			.where(eq(userSettings.userId, ctx.session.user.id))
			.limit(1);

		// A missing row is not an error, it is somebody who has never changed
		// anything — which is what the defaults are for.
		return (
			row ?? { boardTheme: DEFAULT_BOARD_THEME, pieceSet: DEFAULT_PIECE_SET }
		);
	}),

	setAppearance: protectedProcedure
		.input(appearanceInput)
		.mutation(async ({ ctx, input }) => {
			await ctx.db
				.insert(userSettings)
				.values({ userId: ctx.session.user.id, ...input })
				.onDuplicateKeyUpdate({ set: input });

			return input;
		}),

	/**
	 * Everything the Profile route can edit, plus the three things it can only
	 * show: when they joined, whether they are a member, and whether this server
	 * can take an upload at all.
	 *
	 * Membership comes along because the flair picker needs it — the paid group
	 * is the visible half of a subscription, so the picker has to know before it
	 * renders rather than finding out from a rejected save.
	 */
	profile: protectedProcedure.query(async ({ ctx }) => {
		const [row] = await ctx.db
			.select({
				username: users.username,
				name: users.name,
				image: users.image,
				status: users.status,
				flair: users.flair,
				location: users.location,
				country: users.country,
				createdAt: users.createdAt,
				subscriptionStatus: userSubscriptions.status,
			})
			.from(users)
			.leftJoin(userSubscriptions, eq(userSubscriptions.userId, users.id))
			.where(eq(users.id, ctx.session.user.id))
			.limit(1);

		// The session guarantees the row; this is for the type, not for a case
		// that can happen.
		if (!row) throw new TRPCError({ code: "NOT_FOUND" });

		const { subscriptionStatus, ...profile } = row;

		return {
			...profile,
			member: isEntitled(subscriptionStatus ?? "none"),
			// No token, no picture control — better than a button that 500s.
			uploads: Boolean(env.UPLOADTHING_TOKEN),
		};
	}),

	/** The line beside the avatar. Blank clears it. */
	setPublicProfile: protectedProcedure
		.input(publicProfileInput)
		.mutation(async ({ ctx, input }) => {
			const status = orNull(input.status);

			await ctx.db
				.update(users)
				.set({ status })
				.where(eq(users.id, ctx.session.user.id));

			return { status };
		}),

	/**
	 * The emoji beside the handle.
	 *
	 * The membership check is here and not only in the picker: hiding a control
	 * is a courtesy to the honest, while this is what actually decides whether
	 * a paid flair can be worn.
	 */
	setFlair: protectedProcedure
		.input(flairInput)
		.mutation(async ({ ctx, input }) => {
			if (input.flair && flairNeedsMembership(input.flair)) {
				const [subscription] = await ctx.db
					.select({ status: userSubscriptions.status })
					.from(userSubscriptions)
					.where(eq(userSubscriptions.userId, ctx.session.user.id))
					.limit(1);

				if (!isEntitled(subscription?.status ?? "none")) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "That flair comes with a membership.",
					});
				}
			}

			await ctx.db
				.update(users)
				.set({ flair: input.flair })
				.where(eq(users.id, ctx.session.user.id));

			return { flair: input.flair };
		}),

	/**
	 * Name, location and flag — the facts under the handle.
	 *
	 * The country is the only one anything else reads (the leaderboards filter
	 * on it), which is why it is stored upper-cased rather than however it
	 * arrived.
	 */
	setDetails: protectedProcedure
		.input(detailsInput)
		.mutation(async ({ ctx, input }) => {
			const details = {
				name: orNull(input.name),
				location: orNull(input.location),
				country: input.country === "" ? null : input.country.toUpperCase(),
			};

			await ctx.db
				.update(users)
				.set(details)
				.where(eq(users.id, ctx.session.user.id));

			return details;
		}),
});
