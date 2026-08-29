"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { REPORT_GROUPS } from "@/lib/reportReasons";
import { api } from "@/trpc/react";

/**
 * The report dialog, opened from the profile menu.
 *
 * Laid out like chess.com's — reasons grouped under Abuse / Fair Play / Other,
 * a "block them too" checkbox in the footer, and a Report button that stays
 * disabled until a reason is picked.
 *
 * Controlled by `open`/`onOpenChange` rather than the `showModal()` ref it used
 * to be: the same state that opens it is what resets the form, so a dialog
 * dismissed with Escape and one dismissed with Cancel cannot end up in
 * different states.
 */
export default function ReportDialog({
	open,
	onOpenChange,
	username,
	displayName,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	username: string;
	displayName: string;
}) {
	const common = useTranslations("common");
	const t = useTranslations("report");
	const groups = useTranslations("report.groups");
	const reasons = useTranslations("report.reasons");
	const blockId = useId();
	const [reason, setReason] = useState<string | null>(null);
	const [alsoBlock, setAlsoBlock] = useState(false);

	const utils = api.useUtils();

	const report = api.report.create.useMutation({
		onSuccess: (result) => {
			change(false);
			void utils.friend.invalidate();
			if (result.alreadyReported) {
				toast.info(t("already"), {
					description: t("alreadyDetail"),
				});
			} else {
				toast.success(t("sent"), {
					description: t("sentDetail"),
				});
			}
		},
		onError: (error) => toast.error(error.message),
	});

	/** Closing always clears, however it was closed. */
	function change(next: boolean) {
		if (!next) {
			setReason(null);
			setAlsoBlock(false);
		}
		onOpenChange(next);
	}

	return (
		<Dialog onOpenChange={change} open={open}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Report {displayName}</DialogTitle>
				</DialogHeader>

				<RadioGroup
					className="max-h-[50vh] gap-4 overflow-y-auto"
					onValueChange={setReason}
					value={reason ?? ""}
				>
					{REPORT_GROUPS.map((group) => (
						<div key={group.id}>
							<p className="mb-2 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
								{groups(group.id)}
							</p>

							<div className="grid gap-2">
								{group.reasons.map((option) => (
									<div className="flex items-center gap-2.5" key={option.id}>
										<RadioGroupItem id={option.id} value={option.id} />
										<Label className="font-normal" htmlFor={option.id}>
											{reasons(option.id)}
										</Label>
									</div>
								))}
							</div>
						</div>
					))}
				</RadioGroup>

				<div className="flex items-center justify-center gap-2 rounded-lg bg-muted px-4 py-3">
					<Checkbox
						checked={alsoBlock}
						id={blockId}
						onCheckedChange={(checked) => setAlsoBlock(checked === true)}
					/>
					<Label className="font-normal" htmlFor={blockId}>
						Block {displayName}?
					</Label>
				</div>

				<DialogFooter>
					<Button
						className="flex-1"
						onClick={() => change(false)}
						type="button"
						variant="outline"
					>
						{common("cancel")}
					</Button>
					<Button
						className="flex-1"
						disabled={!reason || report.isPending}
						onClick={() => {
							if (!reason) return;
							report.mutate({ username, reason, block: alsoBlock });
						}}
						type="button"
					>
						{report.isPending ? t("sending") : t("send")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
