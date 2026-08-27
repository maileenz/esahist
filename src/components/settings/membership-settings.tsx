"use client";

import { CreditCard, ExternalLink, Eye, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { PieceIcon } from "@/components/chess-pieces";
import { useBoard } from "@/components/theme/theme-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { confirmDestructive } from "@/lib/sweet-alert";

import { api } from "@/trpc/react";

/**
 * Membership.
 *
 * Sections stacked behind hairlines, the way chess.com lays this page out: what
 * you are on and what to do about it, what you have paid, what you pay with.
 * Every one of them reads the same stored snapshot of Stripe, so the page never
 * has to reason about which event arrived first.
 *
 * Nothing here takes a card number. Subscribing hands off to Stripe Checkout
 * and changing a card hands off to their billing portal, which is also what
 * keeps a member to one subscription.
 */
export default function MembershipSettings() {
	const common = useTranslations("common");
	const t = useTranslations("membership");
	const [subscription] = api.billing.subscription.useSuspenseQuery();

	const leave = (url: string) => {
		window.location.href = url;
	};

	const complain = (error: { message: string }) => toast.error(error.message);

	const checkout = api.billing.checkout.useMutation({
		onSuccess: ({ url }) => leave(url),
		onError: complain,
	});
	const portal = api.billing.portal.useMutation({
		onSuccess: ({ url }) => leave(url),
		onError: complain,
	});

	const utils = api.useUtils();
	const refresh = () => void utils.billing.subscription.invalidate();
	const cancel = api.billing.cancel.useMutation({
		onSuccess: refresh,
		onError: complain,
	});
	const resume = api.billing.resume.useMutation({
		onSuccess: refresh,
		onError: complain,
	});

	const busy =
		checkout.isPending ||
		portal.isPending ||
		cancel.isPending ||
		resume.isPending;

	const member = subscription.member;
	// A member whose price is no longer the one on sale keeps their price — so
	// name the thing they have rather than a plan the page can no longer sell.
	const planName = !member
		? t("basic")
		: subscription.currentPrice
			? t("monthly")
			: t("generic");

	return (
		<div className="flex flex-col gap-6">
			<header>
				<h2 className="font-bold text-fg text-xl">{t("title")}</h2>
				<p className="mt-1 text-muted-foreground text-sm">{t("subtitle")}</p>
			</header>

			{!subscription.configured ? (
				<Alert>
					<Info aria-hidden />
					<AlertTitle>{t("billingOff")}</AlertTitle>
					<AlertDescription>
						Set the Stripe keys and the membership price id in the environment
						to turn it on.
					</AlertDescription>
				</Alert>
			) : (
				<>
					{/*
					 * What you are on, and the one control for it: upgrade, cancel, or
					 * resume, whichever the current state leaves to do. Cancelling from
					 * here rather than from a section of its own keeps the state and the
					 * button that changes it in the same glance.
					 */}
					<div className="flex flex-wrap items-center gap-3 rounded-xl bg-elevated p-4">
						<PlanIcon member={member} />

						<div className="min-w-0 flex-1">
							<p className="font-bold text-fg">{planName}</p>
							<PlanNote subscription={subscription} />
						</div>

						{!member ? (
							<Button
								disabled={busy}
								onClick={() => checkout.mutate()}
								type="button"
							>
								{checkout.isPending ? t("opening") : t("upgrade")}
							</Button>
						) : subscription.cancelAtPeriodEnd ? (
							<Button
								disabled={busy}
								onClick={() => resume.mutate()}
								type="button"
								variant="outline"
							>
								{resume.isPending ? t("resuming") : t("resume")}
							</Button>
						) : (
							<Button
								disabled={busy}
								onClick={async () => {
									const sure = await confirmDestructive({
										title: t("cancelConfirmTitle"),
										text: t("cancelConfirmText"),
										confirmText: t("cancel"),
									});
									if (sure) cancel.mutate();
								}}
								type="button"
								variant="outline"
							>
								{cancel.isPending ? t("cancelling") : t("cancel")}
							</Button>
						)}
					</div>

					<Section
						description={t("historyDescription")}
						title={t("historyTitle")}
					>
						<BillingHistory />
					</Section>

					<Section
						description={t("paymentDescription")}
						title={t("paymentTitle")}
					>
						{subscription.card ? (
							<div className="flex flex-wrap items-center gap-3 rounded-lg bg-elevated p-4">
								<CreditCard
									aria-hidden
									className="h-5 w-5 text-muted-foreground"
								/>
								<span className="flex-1 font-medium text-fg text-sm capitalize">
									{subscription.card.brand} ···· {subscription.card.last4}
								</span>
								<Button
									disabled={busy}
									onClick={() => portal.mutate()}
									type="button"
									variant="outline"
								>
									{common("update")}
								</Button>
							</div>
						) : (
							<p className="rounded-lg bg-elevated p-4 text-muted-foreground text-sm">
								{t("noPaymentMethods")}
							</p>
						)}
					</Section>
				</>
			)}
		</div>
	);
}

/** A section: rule, heading, a line about it, and the control. */
function Section({
	title,
	description,
	children,
}: {
	title: string;
	description: string;
	children: React.ReactNode;
}) {
	return (
		<section className="border-line border-t pt-6">
			<h3 className="font-bold text-fg text-lg">{title}</h3>
			<p className="mt-1 text-muted-foreground text-sm">{description}</p>
			<div className="mt-4">{children}</div>
		</section>
	);
}

/** The member's own pieces, promoted: a pawn for basic, a queen for paid. */
function PlanIcon({ member }: { member: boolean }) {
	const { pieceSet } = useBoard();

	return (
		<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface">
			<PieceIcon
				className="h-8 w-8"
				code={member ? "wQ" : "wP"}
				set={pieceSet}
			/>
		</span>
	);
}

function PlanNote({
	subscription,
}: {
	subscription: {
		member: boolean;
		status: string;
		cancelAtPeriodEnd: boolean;
		currentPeriodEnd: Date | string | null;
	};
}) {
	const t = useTranslations("membership");
	if (!subscription.member) {
		return <p className="text-muted-foreground text-sm">{t("basicNote")}</p>;
	}

	const when = subscription.currentPeriodEnd
		? new Date(subscription.currentPeriodEnd).toLocaleDateString(undefined, {
				day: "numeric",
				month: "long",
				year: "numeric",
			})
		: null;

	if (subscription.status === "past_due") {
		return (
			<p className="text-danger text-sm">
				The last payment failed and Stripe is retrying. Membership stays on
				meanwhile — updating the card is the fix.
			</p>
		);
	}

	return (
		<p className="text-muted-foreground text-sm">
			{when
				? subscription.cancelAtPeriodEnd
					? t("endsOn", { date: when })
					: t("renewsOn", { date: when })
				: t("active")}
		</p>
	);
}

/**
 * Receipts, from our own mirror rather than from Stripe — the sync keeps it
 * current. Still behind a button: most visits to this page are not about the
 * history, and a list nobody asked for is just noise above the thing they came
 * for.
 */
function BillingHistory() {
	const common = useTranslations("common");
	const t = useTranslations("membership");
	const [shown, setShown] = useState(false);
	const invoices = api.billing.invoices.useQuery(undefined, { enabled: shown });

	if (!shown) {
		return (
			<Button onClick={() => setShown(true)} type="button" variant="outline">
				<Eye aria-hidden className="mr-1.5 inline h-4 w-4" />
				{t("showHistory")}
			</Button>
		);
	}

	if (invoices.isPending) {
		return <p className="text-muted-foreground text-sm">{common("loading")}</p>;
	}

	if (!invoices.data || invoices.data.length === 0) {
		return (
			<p className="rounded-lg bg-elevated p-4 text-muted-foreground text-sm">
				{t("noInvoices")}
			</p>
		);
	}

	return (
		<ul className="overflow-hidden rounded-lg border border-line">
			{invoices.data.map((invoice) => (
				<li
					className="flex items-center gap-3 border-line border-b bg-surface px-4 py-2.5 text-sm last:border-b-0"
					key={invoice.id}
				>
					<span className="w-28 shrink-0 text-muted-foreground">
						{new Date(invoice.issuedAt).toLocaleDateString(undefined, {
							day: "numeric",
							month: "short",
							year: "numeric",
						})}
					</span>
					<span className="min-w-0 flex-1 truncate text-fg">
						{invoice.number ?? invoice.id}
					</span>
					<span className="shrink-0 font-medium text-fg tabular-nums">
						{money(invoice.total, invoice.currency)}
					</span>
					<span
						className={`w-16 shrink-0 text-right text-xs capitalize ${
							invoice.status === "paid"
								? "text-primary"
								: "text-muted-foreground"
						}`}
					>
						{invoice.status}
					</span>
					{(invoice.pdfUrl ?? invoice.hostedUrl) && (
						<a
							className="shrink-0 text-muted-foreground transition hover:text-fg"
							href={(invoice.pdfUrl ?? invoice.hostedUrl) as string}
							rel="noreferrer"
							target="_blank"
							title={t("receipt")}
						>
							<ExternalLink aria-hidden className="h-4 w-4" />
						</a>
					)}
				</li>
			))}
		</ul>
	);
}

/** Stripe amounts are in the currency's smallest unit. */
function money(total: number, currency: string): string {
	return new Intl.NumberFormat(undefined, {
		style: "currency",
		currency: currency.toUpperCase(),
	}).format(total / 100);
}
