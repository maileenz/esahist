/**
 * What the rest of the app imports from `@/components/theme/theme-provider`.
 *
 * Deliberately client-safe: everything re-exported here comes from
 * `context.tsx`, which is `"use client"` and reaches nothing server-only. Five
 * client components and a hook import `useBoard` through this path, and if this
 * file so much as imports the server provider, `readAppearance` and therefore
 * `next/headers` land in all of their bundles.
 *
 * The server half is `./provider`, imported by its full path from `Providers`
 * and by nothing else.
 */
export { BoardProvider, useBoard } from "./context";
