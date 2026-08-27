import { type LucideIcon, Rocket, Timer, Zap } from "lucide-react";

import type { TimeControlCategory } from "@/lib/timeControls";

/**
 * One lucide icon per pool, used wherever a category needs a face: the profile
 * cards, the leaderboard, the picker. `CATEGORY_META` carries an emoji for the
 * same job, which the lobby still uses — this is the drawn version.
 */
export const CATEGORY_ICONS: Record<TimeControlCategory, LucideIcon> = {
	bullet: Rocket,
	blitz: Zap,
	rapid: Timer,
};
