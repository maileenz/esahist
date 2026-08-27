"use client";

import { Ban, Flag, MoreHorizontal, ShieldOff } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { confirmDestructive } from "@/lib/sweet-alert";
import { api } from "@/trpc/react";
import ReportDialog from "./report-dialog";

/**
 * The "…" beside the friend button: what you can do *about* somebody, as
 * opposed to with them. Reporting and blocking live here rather than in the
 * header, where they sat next to "Add friend" as if they were the same kind of
 * thing.
 *
 * Only ever rendered on somebody else's profile — there is nothing in here you
 * would do to yourself, and a menu with no items is worse than no menu.
 */
export default function ProfileMenu({
	username,
	displayName,
}: {
	username: string;
	displayName: string;
}) {
	const [reporting, setReporting] = useState(false);

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						aria-label={`More actions for ${displayName}`}
						size="icon"
						variant="outline"
					>
						<MoreHorizontal aria-hidden />
					</Button>
				</DropdownMenuTrigger>

				<DropdownMenuContent align="end" className="w-56">
					<DropdownMenuItem onSelect={() => setReporting(true)}>
						<Flag aria-hidden />
						Report {displayName}
					</DropdownMenuItem>

					{/* Last, and the only red thing in here: blocking is the one action
					    that destroys something — an existing friendship — and
					    unblocking does not bring it back. */}
					<BlockItem username={username} />
				</DropdownMenuContent>
			</DropdownMenu>

			<ReportDialog
				displayName={displayName}
				onOpenChange={setReporting}
				open={reporting}
				username={username}
			/>
		</>
	);
}

/**
 * Block and unblock as one toggle, so there is exactly one place on the page
 * that decides this. Reads the status query the header already prefetched, so
 * it is warm by the time the menu opens.
 */
function BlockItem({ username }: { username: string }) {
	const utils = api.useUtils();
	const refresh = () => void utils.friend.invalidate();

	const { data: status } = api.friend.status.useQuery({ username });
	const block = api.friend.block.useMutation({ onSuccess: refresh });
	const unblock = api.friend.unblock.useMutation({ onSuccess: refresh });

	const blocked = status?.state === "blocked";
	const busy = block.isPending || unblock.isPending;

	// Blocking drops any friendship for good — unblocking does not bring it back
	// — so it asks first.
	async function askThenBlock() {
		const confirmed = await confirmDestructive({
			title: `Block @${username}?`,
			text:
				status?.state === "friends"
					? "You will stop being friends, they cannot send you requests, and you will not be matched against each other. Unblocking later does not restore the friendship."
					: "They cannot send you friend requests, and you will not be matched against each other.",
			confirmText: status?.state === "friends" ? "Block and unfriend" : "Block",
		});
		if (confirmed) block.mutate({ username });
	}

	if (blocked) {
		return (
			<DropdownMenuItem
				disabled={busy}
				onSelect={() => unblock.mutate({ username })}
			>
				<ShieldOff aria-hidden />
				Unblock @{username}
			</DropdownMenuItem>
		);
	}

	return (
		<DropdownMenuItem
			disabled={busy}
			// Radix closes the menu on select, which would unmount the dialog
			// underneath the confirm; keeping it open until the answer is in is
			// what stops the page shifting behind the question.
			onSelect={(event) => {
				event.preventDefault();
				void askThenBlock();
			}}
			variant="destructive"
		>
			<Ban aria-hidden />
			Block @{username}
		</DropdownMenuItem>
	);
}
