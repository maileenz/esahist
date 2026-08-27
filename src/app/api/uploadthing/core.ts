import { eq } from "drizzle-orm";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError, UTApi } from "uploadthing/server";

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";

const f = createUploadthing();

/**
 * Only ever *our* uploads.
 *
 * `users.image` may hold a Discord or GitHub CDN URL that arrived with the
 * account, and deleting one of those is both impossible and not ours to try.
 * The pattern is what tells the two apart, so cleanup can only ever reach a
 * file this app put there.
 */
const OUR_FILE = /^https:\/\/[a-z0-9-]+\.ufs\.sh\/f\/([^/?#]+)$/;

function keyOf(url: string | null | undefined): string | null {
	return url ? (OUR_FILE.exec(url)?.[1] ?? null) : null;
}

export const ourFileRouter = {
	/**
	 * A member's avatar.
	 *
	 * The URL is written here rather than sent back for the client to save: this
	 * callback is the only party that knows the upload actually happened, and a
	 * client that can name its own avatar URL can name anybody's.
	 */
	avatar: f({
		image: {
			// An avatar is rendered at 96px. Two megabytes is already generous.
			maxFileSize: "2MB",
			maxFileCount: 1,
		},
	})
		.middleware(async () => {
			const session = await auth();
			if (!session?.user) {
				throw new UploadThingError("Sign in to change your picture.");
			}

			// Everything after this runs on a callback from UploadThing rather than
			// on a request from the browser, so the id has to be carried across.
			return { userId: session.user.id };
		})
		.onUploadComplete(async ({ metadata, file }) => {
			const [before] = await db
				.select({ image: users.image })
				.from(users)
				.where(eq(users.id, metadata.userId))
				.limit(1);

			await db
				.update(users)
				.set({ image: file.ufsUrl })
				.where(eq(users.id, metadata.userId));

			// Best effort, and deliberately after the write: an orphaned file costs
			// storage, but failing here after the avatar has already changed would
			// cost the member their upload.
			const stale = keyOf(before?.image);
			if (stale && stale !== file.key) {
				try {
					await new UTApi().deleteFiles(stale);
				} catch (error) {
					console.error("[uploadthing] could not delete", stale, error);
				}
			}

			return { image: file.ufsUrl };
		}),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
