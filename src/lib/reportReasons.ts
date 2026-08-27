/**
 * The reasons a member can be reported for, grouped the way the dialog shows
 * them. Shared: the dialog renders from this list and the router validates
 * against it, so a new reason is one entry here and nothing else.
 */

export interface ReportGroup {
	label: string;
	reasons: { id: string; label: string }[];
}

export const REPORT_GROUPS: ReportGroup[] = [
	{
		label: "Abuse",
		reasons: [
			{ id: "verbal_abuse", label: "Verbal Abuse / Cursing / Trolling" },
			{ id: "racism", label: "Racism" },
			{ id: "violence", label: "Violence / Threats" },
			{ id: "sexual_harassment", label: "Sexual Harassment" },
		],
	},
	{
		label: "Fair Play",
		reasons: [
			{ id: "cheating", label: "Cheating" },
			{ id: "stalling", label: "Stalling / Quitting Games" },
			{ id: "sandbagging", label: "Sandbagging (Rating Manipulation)" },
		],
	},
	{
		label: "Other",
		reasons: [
			{ id: "avatar", label: "Avatar" },
			{ id: "username", label: "Username" },
			{ id: "spamming", label: "Spamming" },
			{ id: "other", label: "Other" },
		],
	},
];

export const REPORT_REASONS = REPORT_GROUPS.flatMap((group) =>
	group.reasons.map((reason) => reason.id),
) as [string, ...string[]];

export function reportReasonLabel(id: string): string {
	for (const group of REPORT_GROUPS) {
		const found = group.reasons.find((reason) => reason.id === id);
		if (found) return found.label;
	}
	return id;
}
