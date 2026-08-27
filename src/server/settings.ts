import "server-only";

import { eq } from "drizzle-orm";
import { cache } from "react";

import {
	DEFAULT_BOARD_THEME,
	DEFAULT_PIECE_SET,
	resolveBoardTheme,
	resolvePieceSet,
} from "@/lib/themes";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { userSettings } from "@/server/db/schema";

export interface AppearanceSettings {
	boardTheme: string;
	pieceSet: string;
}

const DEFAULT_APPEARANCE: AppearanceSettings = {
	boardTheme: DEFAULT_BOARD_THEME,
	pieceSet: DEFAULT_PIECE_SET,
};

/**
 * The viewer's board and pieces, for the root layout.
 *
 * Deliberately not a tRPC procedure: the layout renders for signed-out visitors
 * too, and a protected query would throw on the login page. Signed out means
 * defaults, which is exactly what a stranger should see.
 *
 * Cached per request — the layout and anything else that asks share one query.
 * Stored values are resolved through the catalogue on the way out, so a row
 * naming a theme that has since been deleted reads as the default rather than
 * painting a board with no colours.
 */
export const readAppearance = cache(async (): Promise<AppearanceSettings> => {
	const session = await auth();
	const userId = session?.user?.id;
	if (!userId) return DEFAULT_APPEARANCE;

	const [row] = await db
		.select({
			boardTheme: userSettings.boardTheme,
			pieceSet: userSettings.pieceSet,
		})
		.from(userSettings)
		.where(eq(userSettings.userId, userId))
		.limit(1);

	if (!row) return DEFAULT_APPEARANCE;

	return {
		boardTheme: resolveBoardTheme(row.boardTheme).id,
		pieceSet: resolvePieceSet(row.pieceSet).id,
	};
});
