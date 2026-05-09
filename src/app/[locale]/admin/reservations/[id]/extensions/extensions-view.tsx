"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarPlus,
  Trash2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input, Field, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/app-shell";
import {
  formatCurrency,
  formatDate,
  monthOptions,
  monthLabel,
  monthKeyFor,
} from "@/lib/utils";
import {
  upsertReservationExtensionAction,
  deleteReservationExtensionAction,
  type ReservationExtensionState,
} from "@/app/actions/reservation-extensions";
import type { Locale } from "@/i18n/config";

type ReservationSummary = {
  id: string;
  propertyName: string;
  propertyColor: string;
  guestName: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  totalPrice: number;
  currency: string;
  paid: boolean;
};

type Extension = {
  id: string;
  reservationId: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  totalPrice: number;
  agencyCommission: number;
  portalCommission: number;
  payout: number;
  currency: string;
  notes: string | null;
  paid: boolean;
  monthKey: string | null;
  detailsFilled: boolean;
};

// Stand-alone page for managing a reservation's extensions. Each card
// is its own form (own action state, own validation) so the admin can
// save them independently — no modal, no nested state juggling.
export function ExtensionsView({
  locale,
  backHref,
  reservation,
  extensions,
}: {
  locale: Locale;
  backHref: string;
  reservation: ReservationSummary;
  extensions: Extension[];
}) {
  const [showDraft, setShowDraft] = useState(false);
  return (
    <div className="space-y-4">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Reservations
      </Link>

      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span
              className="h-8 w-1.5 shrink-0 rounded-full"
              style={{ background: reservation.propertyColor }}
            />
            <span>{reservation.propertyName}</span>
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-muted)]">
            <span>{reservation.guestName ?? "—"}</span>
            <span>·</span>
            <span>
              {formatDate(reservation.checkIn, locale)} →{" "}
              {formatDate(reservation.checkOut, locale)}
            </span>
            <span>·</span>
            <span>
              {reservation.nights} {reservation.nights === 1 ? "night" : "nights"}
            </span>
            <span>·</span>
            <span className="font-semibold">
              {formatCurrency(
                reservation.totalPrice,
                reservation.currency || "AED",
                locale,
              )}
            </span>
            {reservation.paid ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                <CheckCircle2 className="h-3 w-3" />
                Paid
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                Unpaid
              </span>
            )}
          </span>
        }
        right={
          <Button onClick={() => setShowDraft(true)} disabled={showDraft}>
            <CalendarPlus className="h-4 w-4" />
            Add extension
          </Button>
        }
      />

      {extensions.length === 0 && !showDraft && (
        <Card>
          <CardBody className="py-12 text-center text-sm text-[var(--color-muted)]">
            No extensions yet. Click <strong>Add extension</strong> to record
            extra nights manually, or wait for iCal to push them.
          </CardBody>
        </Card>
      )}

      <div className="space-y-3">
        {showDraft && (
          <ExtensionForm
            mode="create"
            reservationId={reservation.id}
            currency={reservation.currency || "AED"}
            locale={locale}
            initialCheckIn={reservation.checkOut}
            onCancel={() => setShowDraft(false)}
            onSaved={() => setShowDraft(false)}
          />
        )}
        {extensions.map((ext) => (
          <ExtensionForm
            key={ext.id}
            mode="edit"
            reservationId={reservation.id}
            currency={reservation.currency || "AED"}
            locale={locale}
            extension={ext}
          />
        ))}
      </div>
    </div>
  );
}

function ExtensionForm({
  mode,
  reservationId,
  currency,
  locale,
  extension,
  initialCheckIn,
  onCancel,
  onSaved,
}: {
  mode: "create" | "edit";
  reservationId: string;
  currency: string;
  locale: Locale;
  extension?: Extension;
  initialCheckIn?: string;
  onCancel?: () => void;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<
    ReservationExtensionState | undefined,
    FormData
  >(upsertReservationExtensionAction, undefined);
  const [deletePending, startDelete] = useTransition();

  const [checkIn, setCheckIn] = useState<string>(
    extension?.checkIn.slice(0, 10) ?? initialCheckIn?.slice(0, 10) ?? "",
  );
  const [checkOut, setCheckOut] = useState<string>(
    extension?.checkOut.slice(0, 10) ?? "",
  );
  const [totalPriceStr, setTotalPriceStr] = useState<string>(
    extension?.totalPrice ? String(extension.totalPrice) : "",
  );
  const [agencyCommissionStr, setAgencyCommissionStr] = useState<string>(
    extension?.agencyCommission ? String(extension.agencyCommission) : "",
  );
  const [portalCommissionStr, setPortalCommissionStr] = useState<string>(
    extension?.portalCommission ? String(extension.portalCommission) : "",
  );
  const [paid, setPaid] = useState<boolean>(extension?.paid ?? false);

  const monthOpts = monthOptions();
  const initialMonth =
    extension?.monthKey ??
    (extension
      ? monthKeyFor(extension.checkIn)
      : monthOpts.find((o) => o.label === monthLabel(new Date()))?.key ??
        monthOpts[6]?.key ??
        "");
  const [monthKey, setMonthKey] = useState<string>(initialMonth);

  useEffect(() => {
    if (state?.status === "ok") {
      router.refresh();
      onSaved?.();
    }
  }, [state, onSaved, router]);

  const totalPrice = parseFloat(totalPriceStr) || 0;
  const agencyCommission = parseFloat(agencyCommissionStr) || 0;
  const portalCommission = parseFloat(portalCommissionStr) || 0;
  const ownerPayout = Math.max(
    0,
    totalPrice - agencyCommission - portalCommission,
  );

  const nightsPreview =
    checkIn && checkOut
      ? Math.max(
          0,
          Math.round(
            (new Date(checkOut).getTime() - new Date(checkIn).getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : extension?.nights ?? 0;

  const needsPricing =
    mode === "edit" && (!extension?.detailsFilled || (extension?.totalPrice ?? 0) <= 0);

  return (
    <Card
      className={`overflow-hidden ${needsPricing ? "border-amber-500/40" : ""}`}
    >
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
              {mode === "create" ? "New extension" : "Extension"}
            </span>
            {needsPricing && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                <AlertCircle className="h-3 w-3" />
                Needs pricing
              </span>
            )}
            {extension?.paid && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                <CheckCircle2 className="h-3 w-3" />
                Paid
              </span>
            )}
          </div>
          {nightsPreview > 0 && (
            <span className="text-xs text-[var(--color-muted)]">
              {nightsPreview} {nightsPreview === 1 ? "night" : "nights"}
            </span>
          )}
        </div>

        <form action={action} className="space-y-4">
          {extension && (
            <input type="hidden" name="id" value={extension.id} />
          )}
          <input type="hidden" name="reservationId" value={reservationId} />
          <input type="hidden" name="currency" value={currency} />
          <input type="hidden" name="paid" value={paid ? "true" : "false"} />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Check-in" htmlFor={`ci-${extension?.id ?? "new"}`}>
              <Input
                id={`ci-${extension?.id ?? "new"}`}
                name="checkIn"
                type="date"
                required
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
              />
            </Field>
            <Field label="Check-out" htmlFor={`co-${extension?.id ?? "new"}`}>
              <Input
                id={`co-${extension?.id ?? "new"}`}
                name="checkOut"
                type="date"
                required
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Field label={`Amount (${currency})`} htmlFor={`tp-${extension?.id ?? "new"}`}>
              <Input
                id={`tp-${extension?.id ?? "new"}`}
                name="totalPrice"
                type="number"
                step="0.01"
                min="0"
                required
                value={totalPriceStr}
                onChange={(e) => setTotalPriceStr(e.target.value)}
              />
            </Field>
            <Field label={`Agency (${currency})`} htmlFor={`ac-${extension?.id ?? "new"}`}>
              <Input
                id={`ac-${extension?.id ?? "new"}`}
                name="agencyCommission"
                type="number"
                step="0.01"
                min="0"
                placeholder="0"
                value={agencyCommissionStr}
                onChange={(e) => setAgencyCommissionStr(e.target.value)}
              />
            </Field>
            <Field label={`Portal (${currency})`} htmlFor={`pc-${extension?.id ?? "new"}`}>
              <Input
                id={`pc-${extension?.id ?? "new"}`}
                name="portalCommission"
                type="number"
                step="0.01"
                min="0"
                placeholder="0"
                value={portalCommissionStr}
                onChange={(e) => setPortalCommissionStr(e.target.value)}
              />
            </Field>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-[var(--color-brand-soft)] px-3 py-2.5 text-sm">
            <span className="text-[var(--color-brand)]">Owner payout</span>
            <span className="text-base font-bold text-[var(--color-brand)]">
              {formatCurrency(ownerPayout, currency, locale)}
            </span>
          </div>

          <label
            className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition-colors ${
              paid
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-[var(--color-border)] bg-white hover:border-[var(--color-brand)]/40"
            }`}
          >
            <input
              type="checkbox"
              checked={paid}
              onChange={(e) => setPaid(e.target.checked)}
              className="mt-1 h-4 w-4 accent-emerald-500"
            />
            <div className="flex-1 text-sm">
              <div className="font-semibold">Paid</div>
              <div className="mt-0.5 text-xs text-[var(--color-muted)]">
                Tick once the guest has paid for this extension.
              </div>
            </div>
          </label>

          <Field label="Bill into" htmlFor={`mk-${extension?.id ?? "new"}`}>
            <select
              id={`mk-${extension?.id ?? "new"}`}
              name="monthKey"
              value={monthKey}
              onChange={(e) => setMonthKey(e.target.value)}
              className="h-11 w-full rounded-xl border-2 border-[var(--color-border)] bg-white px-3 text-sm font-medium transition-colors hover:border-[#cbd5d3] focus:border-[var(--color-brand)] focus:outline-none focus:ring-[3px] focus:ring-[var(--color-brand)]/25"
            >
              {monthOpts.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Notes" htmlFor={`nt-${extension?.id ?? "new"}`}>
            <Textarea
              id={`nt-${extension?.id ?? "new"}`}
              name="notes"
              defaultValue={extension?.notes ?? ""}
              placeholder="Internal notes..."
            />
          </Field>

          {state?.status === "error" && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600">
              {state.message}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            {extension && (
              <Button
                type="button"
                variant="ghost"
                loading={deletePending}
                onClick={() => {
                  if (!confirm("Delete this extension?")) return;
                  startDelete(async () => {
                    await deleteReservationExtensionAction(extension.id);
                    router.refresh();
                  });
                }}
                className="text-rose-500 hover:bg-rose-500/10"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
            {mode === "create" && (
              <Button type="button" variant="secondary" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" loading={pending} className="ml-auto sm:ml-0">
              Save
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
