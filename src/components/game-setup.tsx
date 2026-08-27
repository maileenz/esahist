"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
	FEATURED_PER_CATEGORY,
	TIME_CONTROLS,
	TIME_CONTROLS_BY_CATEGORY,
	type TimeControlId,
} from "@/lib/timeControls";
import { api } from "@/trpc/react";

export interface GameSettings {
	timeControl: TimeControlId;
	ranked: boolean;
}

/**
 * The New Game panel, sized to sit beside the board. The picker collapses into
 * its summary row, and everything past the first three clocks per category is
 * behind "More time controls".
 */
export default function GameSetup({
	settings,
	onChange,
	onPlay,
}: {
	settings: GameSettings;
	onChange: (next: GameSettings) => void;
	onPlay: () => void;
}) {
	const t = useTranslations("lobby");
	const selected = TIME_CONTROLS[settings.timeControl];
	const category = TIME_CONTROLS_BY_CATEGORY.find(
		(group) => group.category === selected.category,
	);

	const [pickerOpen, setPickerOpen] = useState(true);
	// A clock chosen through `?tc=` can sit outside the featured three, and a
	// selection you cannot see is worse than a longer list.
	const [showAll, setShowAll] = useState(
		() =>
			(category?.options.findIndex((option) => option.id === selected.id) ??
				0) >= FEATURED_PER_CATEGORY,
	);

	const stats = api.game.stats.useQuery();

	return (
		<div className="flex flex-col gap-3">
			<section className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
				<button
					aria-expanded={pickerOpen}
					className="flex w-full items-center justify-between gap-2 border-line border-b bg-elevated px-4 py-3 font-semibold text-fg transition hover:brightness-95"
					onClick={() => setPickerOpen((open) => !open)}
					type="button"
				>
					<span className="flex items-center gap-2">
						<span aria-hidden>{category?.icon}</span>
						{selected.label} ({settings.ranked ? t("rated") : t("casual")})
					</span>
					<span className="flex items-center gap-2">
						{/* The rating that is at stake lives on your seat, under the
						    board, where it sits beside the clock it belongs to. */}
						<ChevronDown
							aria-hidden
							className={`h-4 w-4 transition-transform ${
								pickerOpen ? "rotate-180" : ""
							}`}
						/>
					</span>
				</button>

				{pickerOpen && (
					<div className="p-4">
						<div className="flex items-center justify-between">
							<span className="font-medium text-fg text-sm">{t("rated")}</span>
							<Switch
								aria-label={t("ratedGame")}
								checked={settings.ranked}
								onCheckedChange={(ranked) => onChange({ ...settings, ranked })}
							/>
						</div>

						<div className="mt-4 space-y-3">
							{TIME_CONTROLS_BY_CATEGORY.map((group) => {
								const options = showAll
									? group.options
									: group.options.slice(0, FEATURED_PER_CATEGORY);
								return (
									<div key={group.category}>
										<h2 className="mb-1.5 flex items-center gap-1.5 font-semibold text-muted-foreground text-xs">
											<span aria-hidden>{group.icon}</span> {group.label}
										</h2>
										<div className="grid grid-cols-3 gap-2">
											{options.map((control) => {
												const active = control.id === settings.timeControl;
												return (
													<button
														className={`rounded-lg border px-2 py-2.5 font-medium text-sm transition ${
															active
																? "border-primary bg-brand-soft text-primary"
																: "border-line bg-elevated text-fg hover:brightness-95"
														}`}
														key={control.id}
														onClick={() =>
															onChange({
																...settings,
																timeControl: control.id as TimeControlId,
															})
														}
														type="button"
													>
														{control.label}
													</button>
												);
											})}
										</div>
									</div>
								);
							})}
						</div>

						<button
							className="mt-3 flex w-full items-center justify-center gap-1 py-1 font-medium text-muted-foreground text-sm transition hover:text-fg"
							onClick={() => setShowAll((value) => !value)}
							type="button"
						>
							{showAll ? t("fewerTimeControls") : t("moreTimeControls")}
							<ChevronDown
								aria-hidden
								className={`h-4 w-4 transition-transform ${
									showAll ? "rotate-180" : ""
								}`}
							/>
						</button>
					</div>
				)}
			</section>

			<Button onClick={onPlay} size="xl" type="button" variant="chunky">
				{t("startGame")}
			</Button>

			{/*stats.data && (
				<p className="text-center text-subtle text-xs">
					<strong className="font-semibold text-muted-foreground tabular-nums">
						{stats.data.playing.toLocaleString()}
					</strong>{" "}
					{t("playing")}{" "}
					<strong className="ml-2 font-semibold text-muted-foreground tabular-nums">
						{stats.data.gamesToday.toLocaleString()}
					</strong>{" "}
					{t("gamesToday")}
				</p>
			) */}
		</div>
	);
}
