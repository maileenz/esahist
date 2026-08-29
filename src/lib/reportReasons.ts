/**
 * The reasons a member can be reported for, grouped the way the dialog shows
 * them. Shared: the dialog renders from this list and the router validates
 * against it, so a new reason is one entry here and nothing else.
 */

export interface ReportGroup {
	id: ReportGroupId;
	reasons: { id: ReportReasonId }[];
}

/**
 * Ids only. What each one is called is prose, and prose lives in the message
 * catalogues under `report.groups` and `report.reasons` — typing the ids as a
 * union is what lets a caller pass one straight to `t()`, and what makes a
 * reason added here without a name a compile error.
 */
export type ReportGroupId = "abuse" | "fairPlay" | "other";

export type ReportReasonId =
	| "verbal_abuse"
	| "racism"
	| "violence"
	| "sexual_harassment"
	| "cheating"
	| "stalling"
	| "sandbagging"
	| "avatar"
	| "username"
	| "spamming"
	| "other";

export const REPORT_GROUPS: ReportGroup[] = [
	{
		id: "abuse",
		reasons: [
			{ id: "verbal_abuse" },
			{ id: "racism" },
			{ id: "violence" },
			{ id: "sexual_harassment" },
		],
	},
	{
		id: "fairPlay",
		reasons: [{ id: "cheating" }, { id: "stalling" }, { id: "sandbagging" }],
	},
	{
		id: "other",
		reasons: [
			{ id: "avatar" },
			{ id: "username" },
			{ id: "spamming" },
			{ id: "other" },
		],
	},
];

export const REPORT_REASONS = REPORT_GROUPS.flatMap((group) =>
	group.reasons.map((reason) => reason.id),
) as [string, ...string[]];

const REASON_IDS: ReadonlySet<string> = new Set(REPORT_REASONS);

/** Whether a stored value still names a reason this catalogue offers. */
export function isReportReason(value: unknown): value is ReportReasonId {
	return typeof value === "string" && REASON_IDS.has(value);
}
