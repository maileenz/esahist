import "server-only";

import { cache } from "react";

import { api } from "./server";

/**
 * The member profile, resolved once per request.
 *
 * The layout needs it for the header and the overview needs it for the ratings
 * and the record, and a layout cannot hand props to the page it wraps. `cache`
 * is React's answer to exactly that: both call this, only the first one costs
 * a query.
 */
export const memberProfile = cache((username: string) =>
	api.member.profile({ username }),
);

/**
 * One finished game, resolved once per request.
 *
 * `generateMetadata` and the page both need it — the title names the players —
 * and Next calls them separately. Without this the route would fetch the same
 * game, its move history and both players twice on every view.
 */
export const gameById = cache((id: string) => api.member.game({ id }));
