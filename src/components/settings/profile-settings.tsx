"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ImageUp, Loader2, Lock, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import CountrySelect from "@/components/country-select";
import Flag from "@/components/flag";
import Flair from "@/components/flair";
import MemberAvatar from "@/components/member-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUploadThing } from "@/components/uploadthing";
import {
	FLAIR_GROUPS,
	type Flair as FlairEntry,
	MEMBER_ONLY_GROUPS,
	searchFlairs,
} from "@/lib/flairs";
import {
	type DetailsInput,
	detailsInput,
	type FlairInput,
	flairInput,
	LOCATION_MAX,
	NAME_MAX,
	type PublicProfileInput,
	publicProfileInput,
	STATUS_MAX,
} from "@/lib/profile";
import { api } from "@/trpc/react";

/**
 * Public Profile.
 *
 * Three forms rather than one, the way chess.com splits this page: a status, a
 * flair, and the facts underneath. Each saves on its own, so editing your
 * location never risks overwriting a status you were half way through typing.
 *
 * All three resolve against the same zod schemas the procedures validate
 * (`lib/profile.ts`), which is what keeps the character counter and the column
 * width telling the same story.
 */
export default function ProfileSettings() {
	const t = useTranslations("profileSettings");
	const [profile] = api.settings.profile.useSuspenseQuery();

	return (
		<div className="flex flex-col gap-6">
			<header>
				<h2 className="font-bold text-fg text-xl">{t("title")}</h2>
				<p className="mt-1 text-muted-foreground text-sm">{t("subtitle")}</p>
			</header>

			<StatusForm profile={profile} />
			<FlairForm profile={profile} />
			<DetailsForm profile={profile} />
		</div>
	);
}

type Profile = {
	username: string;
	name: string | null;
	image: string | null;
	status: string | null;
	flair: string | null;
	location: string | null;
	country: string | null;
	createdAt: Date | string;
	member: boolean;
	/** False when the server has no UploadThing token, which hides the control. */
	uploads: boolean;
};

/** Avatar, handle, and the fifty characters that sit beside them. */
function StatusForm({ profile }: { profile: Profile }) {
	const t = useTranslations("profileSettings");
	const saved = useSaver();

	const form = useForm<PublicProfileInput>({
		resolver: zodResolver(publicProfileInput),
		defaultValues: { status: profile.status ?? "" },
	});

	const save = api.settings.setPublicProfile.useMutation({
		onSuccess: ({ status }) => {
			form.reset({ status: status ?? "" });
			saved(t("savedProfile"));
		},
		onError: saved.complain,
	});

	const status = form.watch("status");
	const error = form.formState.errors.status?.message;

	return (
		<section className="flex flex-wrap gap-4">
			<AvatarPicker profile={profile} />

			<form
				className="min-w-56 flex-1"
				onSubmit={form.handleSubmit((values) => save.mutate(values))}
			>
				<p className="flex items-center gap-2 font-bold text-fg text-lg">
					{profile.username}
					<Flag className="rounded-xs" code={profile.country} />
					<Flair id={profile.flair} />
				</p>

				<Textarea
					aria-label={t("status")}
					className="mt-2 resize-none"
					disabled={save.isPending}
					placeholder={t("statusPlaceholder")}
					rows={3}
					{...form.register("status")}
				/>

				<div className="mt-1 flex items-center justify-between text-xs">
					<span className="text-destructive">{error}</span>
					{/* Counts what is stored, so a trailing space does not read as a
					    character you have spent. */}
					<span
						className={`tabular-nums ${
							status.trim().length > STATUS_MAX
								? "text-destructive"
								: "text-subtle"
						}`}
					>
						{status.trim().length}/{STATUS_MAX}
					</span>
				</div>

				<Actions
					dirty={form.formState.isDirty}
					onCancel={() => form.reset()}
					pending={save.isPending}
				/>
			</form>
		</section>
	);
}

/**
 * The avatar, and the one control that changes it.
 *
 * Nothing is saved from here: the upload callback writes `users.image` on the
 * server, because it is the only party that knows the file really arrived. All
 * this does afterwards is ask for the page again — sessions are database-backed,
 * so the sidebar's copy of the avatar comes along without a sign-out.
 */
function AvatarPicker({ profile }: { profile: Profile }) {
	const t = useTranslations("profileSettings");
	const saved = useSaver();
	const picker = useRef<HTMLInputElement>(null);
	const { startUpload, isUploading } = useUploadThing("avatar", {
		onClientUploadComplete: () => saved(t("savedPicture")),
		onUploadError: saved.complain,
	});

	return (
		<div className="flex shrink-0 flex-col items-center gap-2">
			<MemberAvatar
				className="size-32 rounded-lg"
				image={profile.image}
				name={profile.username}
			/>

			{profile.uploads && (
				<>
					{/* The real control, kept out of sight rather than hidden: a file
					    input cannot be styled and cannot be opened from script unless
					    it is in the accessibility tree, so `sr-only` and not `hidden`. */}
					<input
						accept="image/*"
						className="sr-only"
						onChange={(event) => {
							const file = event.target.files?.[0];
							// Cleared straight away, so picking the same file twice in a
							// row still fires a change and still uploads.
							event.target.value = "";
							if (file) void startUpload([file]);
						}}
						ref={picker}
						type="file"
					/>

					<Button
						disabled={isUploading}
						onClick={() => picker.current?.click()}
						type="button"
						variant="outline"
					>
						{isUploading ? (
							<Loader2 aria-hidden className="animate-spin" />
						) : (
							<ImageUp aria-hidden />
						)}
						{isUploading ? t("uploading") : t("change")}
					</Button>

					<p className="text-subtle text-xs">{t("maxSize")}</p>
				</>
			)}
		</div>
	);
}

/**
 * The flair picker.
 *
 * A single-field form: the emoji buttons write to it and the schema is the same
 * one the procedure checks, so an id that is not in the catalogue cannot get as
 * far as Save.
 */
function FlairForm({ profile }: { profile: Profile }) {
	const t = useTranslations("profileSettings");
	const saved = useSaver();
	const [query, setQuery] = useState("");

	const form = useForm<FlairInput>({
		resolver: zodResolver(flairInput),
		defaultValues: { flair: profile.flair },
	});

	const save = api.settings.setFlair.useMutation({
		onSuccess: ({ flair }) => {
			form.reset({ flair });
			saved(t("savedFlair"));
		},
		onError: saved.complain,
	});

	const chosen = form.watch("flair");
	const matches = useMemo(() => searchFlairs(query), [query]);

	const pick = (id: string | null) =>
		form.setValue("flair", id, { shouldDirty: true });

	return (
		<form
			className="border-line border-t pt-6"
			onSubmit={form.handleSubmit((values) => save.mutate(values))}
		>
			<h3 className="font-bold text-fg text-lg">{t("flair")}</h3>

			<div className="mt-3 flex flex-wrap items-center gap-3">
				<label className="relative flex-1 basis-56">
					<Search
						aria-hidden
						className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle"
					/>
					<input
						aria-label={t("searchFlairs")}
						className="w-full rounded-lg border border-line bg-elevated py-2 pr-3 pl-9 text-fg text-sm outline-none focus:border-primary"
						onChange={(event) => setQuery(event.target.value)}
						placeholder={t("searchByName")}
						type="search"
						value={query}
					/>
				</label>

				{/* What the handle will look like wearing it. */}
				<p className="flex items-center gap-1.5 font-semibold text-fg text-sm">
					{profile.username}
					<Flag className="rounded-xs" code={profile.country} />
					<Flair id={chosen} />
				</p>

				<Button
					disabled={!chosen || save.isPending}
					onClick={() => pick(null)}
					type="button"
					variant="outline"
				>
					{t("removeFlair")}
				</Button>
			</div>

			<div className="mt-3 max-h-80 overflow-y-auto rounded-xl border border-line bg-elevated p-4">
				{matches.length === 0 ? (
					<p className="py-6 text-center text-muted-foreground text-sm">
						{t("noFlairMatch")}
					</p>
				) : (
					FLAIR_GROUPS.map((group) => {
						const inGroup = matches.filter((flair) => flair.group === group.id);
						if (inGroup.length === 0) return null;

						const locked = !profile.member && MEMBER_ONLY_GROUPS.has(group.id);

						return (
							<section className="mb-4 last:mb-0" key={group.id}>
								<h4 className="flex items-center gap-1.5 font-bold text-fg text-sm">
									{group.label}
									{locked && (
										<span className="flex items-center gap-1 font-semibold text-subtle text-xs">
											<Lock aria-hidden className="h-3 w-3" />
											{t("membersOnly")}
										</span>
									)}
								</h4>

								<div className="mt-2 flex flex-wrap gap-1">
									{inGroup.map((flair) => (
										<FlairButton
											chosen={chosen === flair.id}
											flair={flair}
											key={flair.id}
											locked={locked}
											onPick={() => pick(flair.id)}
										/>
									))}
								</div>
							</section>
						);
					})
				)}
			</div>

			<Actions
				dirty={form.formState.isDirty}
				onCancel={() => form.reset()}
				pending={save.isPending}
			/>
		</form>
	);
}

function FlairButton({
	flair,
	chosen,
	locked,
	onPick,
}: {
	flair: FlairEntry;
	chosen: boolean;
	locked: boolean;
	onPick: () => void;
}) {
	return (
		<button
			aria-label={flair.name}
			aria-pressed={chosen}
			className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg transition ${
				chosen ? "bg-brand-soft ring-2 ring-primary" : "hover:bg-surface"
			} ${locked ? "cursor-not-allowed opacity-40" : ""}`}
			disabled={locked}
			onClick={onPick}
			title={locked ? `${flair.name} — members only` : flair.name}
			type="button"
		>
			{flair.emoji}
		</button>
	);
}

/** The facts under the handle, plus the two that are not editable here. */
function DetailsForm({ profile }: { profile: Profile }) {
	const t = useTranslations("profileSettings");
	const saved = useSaver();

	const form = useForm<DetailsInput>({
		resolver: zodResolver(detailsInput),
		defaultValues: {
			name: profile.name ?? "",
			location: profile.location ?? "",
			country: profile.country ?? "",
		},
	});

	const save = api.settings.setDetails.useMutation({
		onSuccess: (details) => {
			form.reset({
				name: details.name ?? "",
				location: details.location ?? "",
				country: details.country ?? "",
			});
			saved(t("savedDetails"));
		},
		onError: saved.complain,
	});

	return (
		<form
			className="border-line border-t pt-6"
			onSubmit={form.handleSubmit((values) => save.mutate(values))}
		>
			<h3 className="font-bold text-fg text-lg">{t("details")}</h3>

			<dl className="mt-3 flex flex-col gap-3">
				<Row label={t("joined")}>
					<p className="text-fg text-sm">{joinDate(profile.createdAt)}</p>
				</Row>

				{/* Read-only on purpose: the username is the profile's URL, and
				    changing it would break every link anybody has to it. */}
				<Row label={t("username")}>
					<p className="text-fg text-sm">{profile.username}</p>
				</Row>

				<Row label={t("name")}>
					<Field
						disabled={save.isPending}
						error={form.formState.errors.name?.message}
						maxLength={NAME_MAX}
						placeholder={t("namePlaceholder")}
						register={form.register("name")}
					/>
				</Row>

				<Row label={t("location")}>
					<Field
						disabled={save.isPending}
						error={form.formState.errors.location?.message}
						maxLength={LOCATION_MAX}
						placeholder={t("locationPlaceholder")}
						register={form.register("location")}
					/>
				</Row>

				<Row label={t("country")}>
					<CountrySelect
						disabled={save.isPending}
						onChange={(country) =>
							form.setValue("country", country, { shouldDirty: true })
						}
						value={form.watch("country")}
					/>
				</Row>
			</dl>

			<Actions
				dirty={form.formState.isDirty}
				onCancel={() => form.reset()}
				pending={save.isPending}
			/>
		</form>
	);
}

function Row({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-wrap items-center gap-x-4 gap-y-1">
			<dt className="w-24 shrink-0 font-semibold text-muted-foreground text-sm">
				{label}
			</dt>
			<dd className="min-w-56 flex-1">{children}</dd>
		</div>
	);
}

function Field({
	register,
	error,
	...props
}: {
	register: ReturnType<ReturnType<typeof useForm>["register"]>;
	error?: string;
	disabled: boolean;
	maxLength: number;
	placeholder: string;
}) {
	return (
		<>
			<Input type="text" {...props} {...register} />
			{error && <p className="mt-1 text-destructive text-xs">{error}</p>}
		</>
	);
}

/**
 * Cancel and Save.
 *
 * Both are dead until something has actually changed — a Save that writes the
 * values already in the row is a request nobody asked for, and a Cancel with
 * nothing to undo is a button that lies about what it does.
 */
function Actions({
	dirty,
	pending,
	onCancel,
}: {
	dirty: boolean;
	pending: boolean;
	onCancel: () => void;
}) {
	const common = useTranslations("common");
	return (
		<div className="mt-4 flex gap-2">
			<Button
				disabled={!dirty || pending}
				onClick={onCancel}
				type="button"
				variant="outline"
			>
				{common("cancel")}
			</Button>
			<Button disabled={!dirty || pending} type="submit">
				{pending ? common("saving") : common("save")}
			</Button>
		</div>
	);
}

/**
 * What every one of these forms does once it lands: tell the member, and tell
 * the server components — the profile header is rendered on the server, so
 * without the refresh it would keep showing the old handle for a whole
 * navigation.
 */
function useSaver() {
	const router = useRouter();
	const utils = api.useUtils();

	const saved = (title: string) => {
		void utils.settings.profile.invalidate();
		router.refresh();
		toast.success(title);
	};

	// Returns nothing on purpose: `toast.error` hands back an id, and callers
	// like UploadButton's `onUploadError` are typed to want void.
	saved.complain = (error: { message: string }): void => {
		toast.error(error.message);
	};

	return saved;
}

function joinDate(value: Date | string): string {
	return new Date(value).toLocaleDateString(undefined, {
		day: "numeric",
		month: "long",
		year: "numeric",
	});
}
