"use client";

import Link from "next/link";

import Flag from "@/components/flag";
import Flair from "@/components/flair";
import MemberAvatar from "@/components/member-avatar";

/**
 * One person, in a row: the same handle, flag and flair whether they are a
 * friend, a request you have not answered, or somebody you have blocked.
 *
 * `flex-1` on the link rather than on a wrapper, so whatever the caller puts
 * beside it — Accept, Cancel, Unblock — sits hard against the right edge.
 */
export default function Person({
	username,
	image,
	country,
	flair,
}: {
	username: string;
	image: string | null;
	country: string | null;
	flair: string | null;
}) {
	return (
		<Link
			className="flex min-w-0 flex-1 items-center gap-2 hover:underline"
			href={`/member/${username}`}
		>
			<MemberAvatar image={image} name={username} />
			<span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-fg text-sm">
				<Flag className="shrink-0 rounded-xs" code={country} />
				<span className="truncate">{username}</span>
				<Flair className="text-xs" id={flair} />
			</span>
		</Link>
	);
}
