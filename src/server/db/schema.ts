import { relations, sql } from "drizzle-orm";
import {
	index,
	mysqlTableCreator,
	primaryKey,
	uniqueIndex,
} from "drizzle-orm/mysql-core";
import type { AdapterAccount } from "next-auth/adapters";

// Relative, not `@/lib/...`: this file is read by drizzle-kit and by the game
// server, neither of which resolves the Next path alias.
import { DEFAULT_BOARD_THEME, DEFAULT_PIECE_SET } from "../../lib/themes";
import { TIME_CONTROL_CATEGORIES } from "../../lib/timeControls";

/** Where every pool starts, and what an unplayed pool reads as. */
export const DEFAULT_RATING = 600;
/**
 * Glicko-2's starting uncertainty and volatility, from Glickman's paper. A new
 * pool is a wide guess that narrows as somebody plays, which is what moves an
 * early rating a long way and a settled one barely at all.
 */
export const DEFAULT_DEVIATION = 350;
export const DEFAULT_VOLATILITY = 0.06;

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = mysqlTableCreator((name) => name);

export const userRole = ["member", "admin"] as const;

export const users = createTable(
	"user",
	(d) => ({
		id: d
			.varchar({ length: 255 })
			.notNull()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		/**
		 * URL identity: `/member/<username>`. Derived from the provider handle at
		 * sign-in (see `auth/username.ts`); the default is only a safety net so a
		 * NOT NULL insert can never fail on a race.
		 */
		username: d
			.varchar("username", { length: 32 })
			.notNull()
			.$defaultFn(() => `player-${crypto.randomUUID().slice(0, 8)}`),
		name: d.varchar({ length: 255 }),
		email: d.varchar({ length: 255 }).notNull(),
		emailVerified: d
			.timestamp({
				mode: "date",
				fsp: 3,
			})
			.default(sql`CURRENT_TIMESTAMP(3)`),
		image: d.varchar({ length: 255 }),
		/**
		 * ISO 3166-1 alpha-2, nullable because no provider actually tells us:
		 * it is guessed at sign-in and the member can correct or clear it.
		 */
		country: d.char("country", { length: 2 }),
		/**
		 * A line beside the avatar. Fifty characters is the whole point: it is a
		 * status, not a biography, and the limit is enforced by `STATUS_MAX` on
		 * both sides of the wire.
		 */
		status: d.varchar("status", { length: 50 }),
		/**
		 * The emoji beside the handle, stored as a catalogue id rather than the
		 * character — see `lib/flairs.ts` for why. An id that no longer exists
		 * renders as no flair rather than as a broken glyph.
		 */
		flair: d.varchar("flair", { length: 32 }),
		/** Free text, and unverified: "the moon" is a location somebody may pick. */
		location: d.varchar("location", { length: 64 }),
		/**
		 * How many times somebody else has opened this profile.
		 *
		 * Counted, not derived: there is no row-per-view table behind it, so the
		 * number is cheap to read and impossible to break down. That is the whole
		 * feature — a vanity counter, not analytics.
		 */
		views: d.int("views").notNull().default(0),
		/**
		 * Moderation. Only `admin` can reach `/admin`; there is no self-service
		 * promotion — see `scripts/set-role.ts`.
		 */
		role: d.mysqlEnum("role", userRole).notNull().default("member"),
		/**
		 * How many rated games they have finished, across every pool. There is
		 * deliberately no `rating` beside it: a member does not have one, they
		 * have four — see `user_rating`.
		 */
		gamesPlayed: d.int("games_played").notNull().default(0),
		/**
		 * `cus_…`, created the first time this member reaches for checkout and
		 * never changed after.
		 *
		 * It lives here, with the other identities, rather than on the billing
		 * mirror: it is a fact about who they are to Stripe, written once by us,
		 * while everything in `user_subscription` is Stripe's truth overwritten
		 * wholesale on every event. Keeping them apart is what leaves that table
		 * with exactly one writer.
		 */
		stripeCustomerId: d.varchar("stripe_customer_id", { length: 64 }),
		bannedAt: d.timestamp("banned_at"),
		/**
		 * When they joined. Written once at insert and never updated, which is
		 * what makes it safe to show on a profile as a fact rather than as the
		 * last time anything about the row changed.
		 */
		createdAt: d
			.timestamp("created_at")
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`),
	}),
	(t) => [
		uniqueIndex("user_username_idx").on(t.username),
		// One member per customer, both ways round: the sync looks a member up by
		// the customer id every time an event arrives.
		uniqueIndex("user_stripe_customer_idx").on(t.stripeCustomerId),
	],
);

export const usersRelations = relations(users, ({ many }) => ({
	accounts: many(accounts),
	sessions: many(sessions),
	ratings: many(userRatings),
}));

/**
 * One rating per pool, the way every chess site does it: a bullet game and a
 * rapid game measure different things and must not move the same number.
 *
 * The pools are the time-control categories, imported rather than re-listed so
 * adding a category to the whitelist cannot leave a pool nobody can reach.
 *
 * A missing row means "has never played this pool" and reads as an unrated
 * `DEFAULT_RATING` — the row is written by the first rated game, which keeps a
 * member who only plays blitz from carrying three meaningless numbers around.
 *
 * This table is the only place a rating lives. The user row used to carry a
 * denormalised headline as well, which was one number claiming to speak for
 * four and a second copy free to drift; anything that wants "their rating" now
 * has to say which one it means.
 */
export const userRatings = createTable(
	"user_rating",
	(d) => ({
		userId: d
			.varchar("user_id", { length: 255 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		category: d.mysqlEnum("category", TIME_CONTROL_CATEGORIES).notNull(),
		gamesPlayed: d.int("games_played").notNull().default(0),
		/** Highest this pool has ever been, for the profile. */
		peakRating: d.smallint("peak_rating").notNull().default(DEFAULT_RATING),
		rating: d.smallint("rating").notNull().default(DEFAULT_RATING),
		/** Glicko-2 carries its own uncertainty; these two are what it needs back. */
		ratingDeviation: d
			.double("rating_deviation")
			.notNull()
			.default(DEFAULT_DEVIATION),
		volatility: d.double("volatility").notNull().default(DEFAULT_VOLATILITY),
		/** When this pool last moved — the tie-break for which one is the headline. */
		lastPlayedAt: d.timestamp("last_played_at").notNull().defaultNow(),
	}),
	(table) => [primaryKey({ columns: [table.userId, table.category] })],
);

export const userRatingsRelations = relations(userRatings, ({ one }) => ({
	user: one(users, { fields: [userRatings.userId], references: [users.id] }),
}));

/**
 * How a member wants the site to look and behave. One row each, written the
 * first time they change anything — a missing row means "all defaults", so
 * nothing has to be back-filled and a new setting is a column with a default
 * rather than a migration over every user.
 *
 * The board and the piece set live here rather than in `localStorage` because
 * a preference that follows you to another browser is the point of having an
 * account, and because the server can then paint the right board in the first
 * response instead of correcting it after hydration.
 */
export const userSettings = createTable("user_setting", (d) => ({
	userId: d
		.varchar("user_id", { length: 255 })
		.notNull()
		.primaryKey()
		.references(() => users.id, { onDelete: "cascade" }),
	boardTheme: d
		.varchar("board_theme", { length: 16 })
		.notNull()
		.default(DEFAULT_BOARD_THEME),
	pieceSet: d
		.varchar("piece_set", { length: 16 })
		.notNull()
		.default(DEFAULT_PIECE_SET),
	updatedAt: d.timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
	user: one(users, { fields: [userSettings.userId], references: [users.id] }),
}));

/**
 * Every Stripe status this app can be told about, plus `none` for a member who
 * has a customer record but has never subscribed. Stored as text rather than an
 * enum: Stripe owns this vocabulary and can add to it, and a webhook arriving
 * with a status MySQL refuses is a worse failure than a string we do not
 * recognise.
 */
export const SUBSCRIPTION_STATUSES = [
	"none",
	"incomplete",
	"incomplete_expired",
	"trialing",
	"active",
	"past_due",
	"canceled",
	"unpaid",
	"paused",
] as const;

/**
 * A member's billing, as a mirror of Stripe rather than a second source of
 * truth. One row per member, written *only* by `syncStripeData` — every webhook
 * and every return from checkout funnels through that one function, so there is
 * no ordering between events to get wrong and no partial state to reconcile.
 *
 * There is no customer id here on purpose. That binding is on `user.
 * stripe_customer_id`, written once when the customer is created; if it lived
 * in this row, the table would have a second writer and the rule above would
 * only be nearly true.
 */
export const userSubscriptions = createTable("user_subscription", (d) => ({
	userId: d
		.varchar("user_id", { length: 255 })
		.notNull()
		.primaryKey()
		.references(() => users.id, { onDelete: "cascade" }),
	/** `sub_…`, null until they have subscribed at least once. */
	subscriptionId: d.varchar("subscription_id", { length: 64 }),
	status: d.varchar("status", { length: 32 }).notNull().default("none"),
	/** The price they are on — kept verbatim, since prices get retired. */
	priceId: d.varchar("price_id", { length: 64 }),
	currentPeriodStart: d.timestamp("current_period_start"),
	currentPeriodEnd: d.timestamp("current_period_end"),
	cancelAtPeriodEnd: d.boolean("cancel_at_period_end").notNull().default(false),
	/** Enough of the card to recognise it; never enough to charge it. */
	paymentBrand: d.varchar("payment_brand", { length: 32 }),
	paymentLast4: d.varchar("payment_last4", { length: 4 }),
	updatedAt: d.timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
}));

export const userSubscriptionsRelations = relations(
	userSubscriptions,
	({ one }) => ({
		user: one(users, {
			fields: [userSubscriptions.userId],
			references: [users.id],
		}),
	}),
);

/**
 * Invoices, mirrored from Stripe. Also written only by `syncStripeData`, and
 * for the same reason: one writer, whole rows, no reconstructing history from
 * the event that happened to arrive.
 *
 * Keyed by Stripe's own id so a re-sync overwrites rather than duplicates. The
 * sync refreshes a window of the most recent invoices and older rows simply
 * stay — the table accumulates, which is the point of keeping it rather than
 * asking Stripe every time.
 */
export const userInvoices = createTable(
	"user_invoice",
	(d) => ({
		/** `in_…`, Stripe's id and ours. */
		id: d.varchar("id", { length: 64 }).notNull().primaryKey(),
		userId: d
			.varchar("user_id", { length: 255 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		/** The human-facing number on the receipt, absent while a draft. */
		number: d.varchar("number", { length: 32 }),
		/** draft · open · paid · uncollectible · void */
		status: d.varchar("status", { length: 24 }),
		/** In the currency's smallest unit, as Stripe counts money. */
		total: d.int("total").notNull(),
		currency: d.varchar("currency", { length: 8 }).notNull(),
		issuedAt: d.timestamp("issued_at").notNull(),
		paidAt: d.timestamp("paid_at"),
		/** Stripe's own receipt page and the PDF behind it. */
		hostedUrl: d.varchar("hosted_url", { length: 512 }),
		pdfUrl: d.varchar("pdf_url", { length: 512 }),
		updatedAt: d.timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
	}),
	(table) => [index("user_invoice_user_idx").on(table.userId, table.issuedAt)],
);

export const userInvoicesRelations = relations(userInvoices, ({ one }) => ({
	user: one(users, { fields: [userInvoices.userId], references: [users.id] }),
}));

export const accounts = createTable(
	"account",
	(d) => ({
		userId: d
			.varchar({ length: 255 })
			.notNull()
			.references(() => users.id),
		type: d.varchar({ length: 255 }).$type<AdapterAccount["type"]>().notNull(),
		provider: d.varchar({ length: 255 }).notNull(),
		providerAccountId: d.varchar({ length: 255 }).notNull(),
		refresh_token: d.text(),
		access_token: d.text(),
		expires_at: d.int(),
		token_type: d.varchar({ length: 255 }),
		scope: d.varchar({ length: 255 }),
		id_token: d.text(),
		session_state: d.varchar({ length: 255 }),
	}),
	(t) => [
		primaryKey({
			columns: [t.provider, t.providerAccountId],
		}),
		index("account_user_id_idx").on(t.userId),
	],
);

export const accountsRelations = relations(accounts, ({ one }) => ({
	user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = createTable(
	"session",
	(d) => ({
		sessionToken: d.varchar({ length: 255 }).notNull().primaryKey(),
		userId: d
			.varchar({ length: 255 })
			.notNull()
			.references(() => users.id),
		expires: d.timestamp({ mode: "date" }).notNull(),
	}),
	(t) => [index("session_user_id_idx").on(t.userId)],
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
	user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = createTable(
	"verification_token",
	(d) => ({
		identifier: d.varchar({ length: 255 }).notNull(),
		token: d.varchar({ length: 255 }).notNull(),
		expires: d.timestamp({ mode: "date" }).notNull(),
	}),
	(t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/* -------------------------------------------------------------------- chess */

export const gameStatus = ["playing", "finished", "aborted"] as const;
export const gameResult = ["1-0", "0-1", "1/2-1/2", "*"] as const;

export const games = createTable(
	"game",
	(d) => ({
		/** Generated by the room, so the row can be written before the game ends. */
		id: d.char("id", { length: 36 }).primaryKey(),
		roomId: d.varchar("room_id", { length: 24 }).notNull(),

		timeControl: d.varchar("time_control", { length: 12 }).notNull(),
		initialTimeMs: d.int("initial_time_ms").notNull(),
		incrementMs: d.int("increment_ms").notNull(),
		ranked: d.boolean("ranked").notNull().default(true),

		whiteUserId: d
			.varchar("white_user_id", { length: 255 })
			.notNull()
			.references(() => users.id),
		blackUserId: d
			.varchar("black_user_id", { length: 255 })
			.notNull()
			.references(() => users.id),

		status: d.mysqlEnum("status", gameStatus).notNull().default("playing"),
		result: d.mysqlEnum("result", gameResult),
		/** checkmate, timeout, resignation, abandonment, … */
		reason: d.varchar("reason", { length: 40 }),
		winnerColor: d.char("winner_color", { length: 1 }),

		/** Space-separated SAN. Enough on its own to replay the game. */
		moves: d.text("moves"),
		finalFen: d.varchar("final_fen", { length: 100 }),
		pgn: d.text("pgn"),
		ply: d.smallint("ply").notNull().default(0),

		whiteRatingBefore: d.smallint("white_rating_before"),
		blackRatingBefore: d.smallint("black_rating_before"),
		whiteRatingDelta: d.smallint("white_rating_delta"),
		blackRatingDelta: d.smallint("black_rating_delta"),
		/** Guard so a retried save can never double-apply Elo. */
		ratingsApplied: d.boolean("ratings_applied").notNull().default(false),

		startedAt: d.timestamp("started_at").notNull().defaultNow(),
		endedAt: d.timestamp("ended_at"),
	}),
	(table) => [
		index("games_white_idx").on(table.whiteUserId, table.startedAt),
		index("games_black_idx").on(table.blackUserId, table.startedAt),
		index("games_status_idx").on(table.status),
	],
);

export const gamesRelations = relations(games, ({ one, many }) => ({
	white: one(users, {
		fields: [games.whiteUserId],
		references: [users.id],
		relationName: "white",
	}),
	black: one(users, {
		fields: [games.blackUserId],
		references: [users.id],
		relationName: "black",
	}),
	history: many(gamesHistory),
}));

/**
 * One row per half-move. Drop this table if the PGN on `games` is enough for
 * you — it exists so you can show clock-per-move, build an opening explorer,
 * or resume an interrupted game without parsing PGN.
 */
export const gamesHistory = createTable(
	"game_history",
	(d) => ({
		gameId: d
			.char("game_id", { length: 36 })
			.notNull()
			.references(() => games.id, { onDelete: "cascade" }),
		ply: d.smallint("ply").notNull(),
		color: d.char("color", { length: 1 }).notNull(),
		san: d.varchar("san", { length: 12 }).notNull(),
		fromSquare: d.char("from_square", { length: 2 }).notNull(),
		toSquare: d.char("to_square", { length: 2 }).notNull(),
		promotion: d.char("promotion", { length: 1 }),
		fenAfter: d.varchar("fen_after", { length: 100 }).notNull(),
		/** Mover's remaining time after the increment was credited. */
		clockMs: d.int("clock_ms").notNull(),
		/** Time spent on this move, in ms. */
		thinkMs: d.int("think_ms").notNull(),
		playedAt: d.timestamp("played_at").notNull().defaultNow(),
	}),
	(table) => [
		primaryKey({ columns: [table.gameId, table.ply] }),
		uniqueIndex("games_history_game_ply_idx").on(table.gameId, table.ply),
	],
);

export const gamesHistoryRelations = relations(gamesHistory, ({ one }) => ({
	game: one(games, { fields: [gamesHistory.gameId], references: [games.id] }),
}));

/* ---------------------------------------------------------------- friends */

export const friendshipStatus = ["pending", "accepted"] as const;

/**
 * One row per relationship, kept in the direction it was asked in — a request
 * has a sender and a receiver, and that is what the profile button needs to
 * know. There is deliberately no `declined`: declining deletes the row, so the
 * pair is back to having no relationship and either side may ask again.
 *
 * The primary key stops duplicate requests in one direction; a reciprocal
 * request (B asks A while A→B is pending) is turned into an acceptance by the
 * router rather than becoming a second row.
 */
export const friendships = createTable(
	"friendship",
	(d) => ({
		requesterId: d
			.varchar("requester_id", { length: 255 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		addresseeId: d
			.varchar("addressee_id", { length: 255 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		status: d
			.mysqlEnum("status", friendshipStatus)
			.notNull()
			.default("pending"),
		createdAt: d.timestamp("created_at").notNull().defaultNow(),
		respondedAt: d.timestamp("responded_at"),
	}),
	(table) => [
		primaryKey({ columns: [table.requesterId, table.addresseeId] }),
		index("friendship_addressee_idx").on(table.addresseeId, table.status),
		index("friendship_requester_idx").on(table.requesterId, table.status),
	],
);

/**
 * Directional and one-sided on purpose: "A blocked B" is A's decision, and B is
 * never told. Kept out of `friendship` because the two relations behave
 * differently — a friendship is symmetric once accepted, a block never is, and
 * blocking someone you have no relationship with has to be possible.
 */
export const userBlocks = createTable(
	"user_block",
	(d) => ({
		blockerId: d
			.varchar("blocker_id", { length: 255 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		blockedId: d
			.varchar("blocked_id", { length: 255 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		createdAt: d.timestamp("created_at").notNull().defaultNow(),
	}),
	(table) => [
		primaryKey({ columns: [table.blockerId, table.blockedId] }),
		// The room checks "is either of these two blocking the other?" on every
		// join, which reads both ways round.
		index("user_block_blocked_idx").on(table.blockedId),
	],
);

export const reportStatus = ["open", "reviewed", "dismissed"] as const;

/**
 * Moderation queue. Unlike blocks there can be many rows per pair — a member
 * may be reported repeatedly, by different people and for different reasons —
 * so this has a surrogate key rather than a composite one.
 *
 * `reason` is validated against `src/lib/reportReasons.ts`, the same list the
 * dialog renders from.
 */
export const userReports = createTable(
	"user_report",
	(d) => ({
		id: d
			.char("id", { length: 36 })
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		reporterId: d
			.varchar("reporter_id", { length: 255 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		reportedId: d
			.varchar("reported_id", { length: 255 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		reason: d.varchar("reason", { length: 32 }).notNull(),
		status: d.mysqlEnum("status", reportStatus).notNull().default("open"),
		createdAt: d.timestamp("created_at").notNull().defaultNow(),
	}),
	(table) => [
		// "What has been reported about this member?" — the moderator's question.
		index("user_report_reported_idx").on(table.reportedId, table.status),
		// "Has this person already reported them?" — the duplicate guard.
		index("user_report_reporter_idx").on(table.reporterId, table.reportedId),
	],
);

export const userReportsRelations = relations(userReports, ({ one }) => ({
	reporter: one(users, {
		fields: [userReports.reporterId],
		references: [users.id],
		relationName: "reporter",
	}),
	reported: one(users, {
		fields: [userReports.reportedId],
		references: [users.id],
		relationName: "reported",
	}),
}));

export const userBlocksRelations = relations(userBlocks, ({ one }) => ({
	blocker: one(users, {
		fields: [userBlocks.blockerId],
		references: [users.id],
		relationName: "blocker",
	}),
	blocked: one(users, {
		fields: [userBlocks.blockedId],
		references: [users.id],
		relationName: "blocked",
	}),
}));

export const friendshipsRelations = relations(friendships, ({ one }) => ({
	requester: one(users, {
		fields: [friendships.requesterId],
		references: [users.id],
		relationName: "requester",
	}),
	addressee: one(users, {
		fields: [friendships.addresseeId],
		references: [users.id],
		relationName: "addressee",
	}),
}));
