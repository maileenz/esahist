import Link from "next/link";

import Flag from "@/components/flag";
import Flair from "@/components/flair";
import MemberAvatar from "@/components/member-avatar";

/**
 * The medal colours are deliberately fixed rather than themed: gold, silver and
 * bronze mean the same thing on every background, and a podium that changed
 * colour with the site's palette would stop reading as a podium.
 */
const MEDALS = ["#f0b429", "#adb5bd", "#c17f3f"];

/** Rank marker: a medal for the podium, a plain number for everybody else. */
export function Place({ place }: { place: number }) {
	const medal = MEDALS[place - 1];

	if (medal) {
		return (
			<span
				className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-bold text-[13px] text-black/80 tabular-nums"
				style={{ backgroundColor: medal }}
			>
				{place}
			</span>
		);
	}

	return (
		<span className="flex h-7 w-7 shrink-0 items-center justify-center font-semibold text-sm text-subtle tabular-nums">
			#{place}
		</span>
	);
}

export interface LeaderboardPlayer {
	username: string;
	image: string | null;
	country: string | null;
	flair: string | null;
}

/** Avatar, handle, flag and flair, linked to the profile. */
export function Player({ player }: { player: LeaderboardPlayer }) {
	return (
		<Link
			className="flex min-w-0 flex-1 items-center gap-2 hover:underline"
			href={`/member/${player.username}`}
		>
			<MemberAvatar
				className="size-7 rounded-md"
				image={player.image}
				name={player.username}
			/>
			<span className="min-w-0 truncate font-semibold text-fg text-sm">
				{player.username}
			</span>
			<Flag className="shrink-0 rounded-xs" code={player.country} />
			<Flair id={player.flair} />
		</Link>
	);
}
