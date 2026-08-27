"use client";

import { generateReactHelpers } from "@uploadthing/react";

import type { OurFileRouter } from "@/app/api/uploadthing/core";

/**
 * UploadThing's hooks, typed against our file router so a route slug that does
 * not exist is a compile error rather than a 404 at click time.
 *
 * The hook rather than `generateUploadButton`, because their button brings its
 * own classes and concatenates ours onto them instead of replacing them: the
 * `text-white` it hard-codes for its blue face survived onto our outline
 * button, which is how the avatar control ended up with white text on a cream
 * background. Owning the markup is the only way to be sure there is one design
 * system in the bundle.
 */
export const { useUploadThing } = generateReactHelpers<OurFileRouter>();
