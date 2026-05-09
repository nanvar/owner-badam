"use client";

import {
  Fragment,
  useActionState,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Trash2,
  Phone,
  Mail,
  Search,
  RefreshCw,
  AlertTriangle,
  Plus,
  AlertCircle,
  CalendarPlus,
  ChevronDown,
  Edit3,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input, Field, Textarea } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { PageHeader } from "@/components/app-shell";
import {
  formatCurrency,
  formatDate,
  monthOptions,
  monthLabel,
  monthKeyFor,
} from "@/lib/utils";
import {
  updateReservationAction,
  deleteReservationAction,
  createCompanyReservationAction,
  type ReservationState,
} from "@/app/actions/reservations";
import {
  upsertReservationExtensionAction,
  deleteReservationExtensionAction,
  type ReservationExtensionState,
} from "@/app/actions/reservation-extensions";
import { syncAllAction, type SyncState } from "@/app/actions/sync";
import { SyncSummary } from "../properties-view";
import { MonthSelector } from "../company/month-selector";
import type { Locale } from "@/i18n/config";

export type ReservationExtensionItem = {
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

export type ReservationItem = {
  id: string;
  propertyId: string;
  propertyName: string;
  propertyColor: string;
  guestName: string | null;
  guestPhone: string | null;
  guestEmail: string | null;
  numGuests: number | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  pricePerNight: number;
  cleaningFee: number;
  agencyCommission: number;
  portalCommission: number;
  serviceFee: number;
  taxes: number;
  totalPrice: number;
  payout: number;
  currency: string;
  notes: string | null;
  detailsFilled: boolean;
  paid: boolean;
  rawSummary: string | null;
  extensions: ReservationExtensionItem[];
};

export function ReservationsView({
  locale,
  items,
  properties,
  monthOptions: monthOpts,
  selectedMonth,
  basePath,
  labels,
}: {
  locale: Locale;
  items: ReservationItem[];
  properties: { id: string; name: string; color: string }[];
  monthOptions: { key: string; label: string }[];
  selectedMonth: string;
  basePath: string;
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ReservationItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletePending, startDelete] = useTransition();
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [syncPending, startSync] = useTransition();

  const filtered = useMemo(() => {
    const list = items.filter((i) => {
      if (search) {
        const q = search.toLowerCase();
        const blob = `${i.guestName ?? ""} ${i.propertyName} ${i.rawSummary ?? ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
    // Stable bucket sort: live (currently ongoing) on top, scheduled in
    // the middle, done (already checked out) at the bottom.
    const now = Date.now();
    const bucket = (i: (typeof items)[number]) => {
      const ci = new Date(i.checkIn).getTime();
      const co = new Date(i.checkOut).getTime();
      if (ci <= now && co > now) return 0; // live
      if (co <= now) return 2; // done
      return 1; // future
    };
    return list
      .map((i, idx) => ({ i, idx, b: bucket(i) }))
      .sort((a, b) => a.b - b.b || a.idx - b.idx)
      .map(({ i }) => i);
  }, [items, search]);
  const firstDoneIndex = useMemo(() => {
    const now = Date.now();
    return filtered.findIndex((i) => new Date(i.checkOut).getTime() <= now);
  }, [filtered]);
  const incompleteCount = useMemo(
    () => items.filter((i) => !i.detailsFilled).length,
    [items],
  );

  return (
    <div>
      <PageHeader
        title={labels.title}
        right={
          <div className="flex items-center gap-2">
            <MonthSelector
              options={monthOpts}
              selected={selectedMonth}
              basePath={basePath}
              allowAll
            />
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              {labels.newReservation ?? "New reservation"}
            </Button>
            <Button
              variant="secondary"
              loading={syncPending}
              onClick={() =>
                startSync(async () => {
                  const r = await syncAllAction();
                  setSyncState(r);
                  if (r.status === "ok") router.refresh();
                })
              }
            >
              <RefreshCw className="h-4 w-4" />
              {syncPending ? labels.syncing : labels.syncNow}
            </Button>
          </div>
        }
      />
      {syncState && syncState.status === "ok" && (
        <SyncSummary
          results={syncState.results}
          onClose={() => setSyncState(null)}
        />
      )}
      {syncState && syncState.status === "error" && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600">
          <AlertTriangle className="h-4 w-4" />
          {syncState.message}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search guest or property"
            className="pl-9"
          />
        </div>
        <Link
          href={`${basePath}/incomplete`}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--color-muted)] transition-colors hover:border-amber-500/40 hover:text-amber-700"
        >
          <AlertCircle className="h-4 w-4" />
          Incomplete
          {incompleteCount > 0 && (
            <span className="rounded-full bg-amber-500/15 px-1.5 text-[10px] font-bold text-amber-700">
              {incompleteCount}
            </span>
          )}
        </Link>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardBody className="py-12 text-center text-sm text-[var(--color-muted)]">
            No reservations found.
          </CardBody>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="grid-table w-full text-sm">
              <thead className="bg-[var(--color-surface-2)] text-xs uppercase tracking-wider text-[var(--color-muted)]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">{labels.property ?? "Property"}</th>
                  <th className="px-4 py-3 text-left font-semibold">{labels.guestName}</th>
                  <th className="px-4 py-3 text-left font-semibold">{labels.checkIn}</th>
                  <th className="px-4 py-3 text-left font-semibold">{labels.checkOut}</th>
                  <th className="px-4 py-3 text-right font-semibold">{labels.nights}</th>
                  <th className="px-4 py-3 text-right font-semibold">{labels.pricePerNight}</th>
                  <th className="px-4 py-3 text-right font-semibold">{labels.totalPrice}</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => (
                  <Fragment key={r.id}>
                    {idx > 0 && idx === firstDoneIndex && (
                      <tr aria-hidden>
                        <td colSpan={8} className="h-6 border-x-0 border-b-0" />
                      </tr>
                    )}
                    <tr
                      onClick={() => setEditing(r)}
                      className={`cursor-pointer border-t border-[var(--color-border)] ${
                        !r.paid
                          ? "bg-amber-500/10 hover:bg-amber-500/15"
                          : "hover:bg-[var(--color-surface-2)]/60"
                      }`}
                    >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-7 w-1 shrink-0 rounded-full"
                          style={{ background: r.propertyColor }}
                        />
                        <span className="font-medium">{r.propertyName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{r.guestName ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDate(r.checkIn, locale)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDate(r.checkOut, locale)}
                    </td>
                    <td className="px-4 py-3 text-right">{r.nights}</td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(r.pricePerNight, r.currency || "AED", locale)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatCurrency(r.totalPrice, r.currency || "AED", locale)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(() => {
                          const now = Date.now();
                          const ci = new Date(r.checkIn).getTime();
                          const co = new Date(r.checkOut).getTime();
                          if (ci <= now && co > now) {
                            return (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-600">
                                <span className="relative grid h-2 w-2 place-items-center">
                                  <span className="absolute inset-0 animate-ping rounded-full bg-rose-500/60" />
                                  <span className="relative h-2 w-2 rounded-full bg-rose-500" />
                                </span>
                                Live
                              </span>
                            );
                          }
                          if (co <= now) {
                            return (
                              <span className="inline-flex items-center rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                                Done
                              </span>
                            );
                          }
                          return null;
                        })()}
                        {r.paid ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                            Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                            Unpaid
                          </span>
                        )}
                        {r.extensions.length > 0 && (
                          <span
                            className="inline-flex items-center rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-700"
                            title={`${r.extensions.length} extension${r.extensions.length === 1 ? "" : "s"}`}
                          >
                            +{r.extensions.length} ext
                          </span>
                        )}
                      </div>
                    </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ReservationEditor
        key={editing?.id ?? "empty"}
        reservation={editing}
        labels={labels}
        locale={locale}
        onClose={() => setEditing(null)}
        onDelete={(id) =>
          startDelete(async () => {
            await deleteReservationAction(id);
            setEditing(null);
            router.refresh();
          })
        }
        deletePending={deletePending}
      />

      <CompanyReservationCreator
        key={creating ? "open" : "closed"}
        open={creating}
        properties={properties}
        labels={labels}
        locale={locale}
        onClose={() => setCreating(false)}
      />
    </div>
  );
}

export function ReservationEditor({
  reservation,
  labels,
  locale,
  onClose,
  onDelete,
  deletePending,
}: {
  reservation: ReservationItem | null;
  labels: Record<string, string>;
  locale: Locale;
  onClose: () => void;
  onDelete: (id: string) => void;
  deletePending: boolean;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ReservationState | undefined, FormData>(
    updateReservationAction,
    undefined,
  );
  const [totalPriceStr, setTotalPriceStr] = useState<string>(
    reservation?.totalPrice ? String(reservation.totalPrice) : "",
  );
  const [agencyCommissionStr, setAgencyCommissionStr] = useState<string>(
    reservation?.agencyCommission
      ? String(reservation.agencyCommission)
      : "",
  );
  const [portalCommissionStr, setPortalCommissionStr] = useState<string>(
    reservation?.portalCommission
      ? String(reservation.portalCommission)
      : "",
  );
  const totalPrice = parseFloat(totalPriceStr) || 0;
  const agencyCommission = parseFloat(agencyCommissionStr) || 0;
  const portalCommission = parseFloat(portalCommissionStr) || 0;
  const [paid, setPaid] = useState<boolean>(reservation?.paid ?? false);
  const monthOpts = monthOptions();
  const defaultMonth = reservation
    ? monthKeyFor(reservation.checkIn)
    : monthOpts.find((o) => o.label === monthLabel(new Date()))?.key ??
      monthOpts[6]?.key ??
      "";
  const [monthKey, setMonthKey] = useState<string>(defaultMonth);

  useEffect(() => {
    if (state?.status === "ok") {
      router.refresh();
      onClose();
    }
  }, [state, onClose, router]);

  if (!reservation) {
    return null;
  }

  const ownerPayout = Math.max(0, totalPrice - agencyCommission - portalCommission);
  const pricePerNightCalc =
    reservation.nights > 0 ? totalPrice / reservation.nights : 0;

  return (
    <Sheet
      open={!!reservation}
      onClose={onClose}
      title={reservation.propertyName}
      description={`${formatDate(reservation.checkIn, locale)} → ${formatDate(reservation.checkOut, locale)} · ${reservation.nights} nights`}
    >
      <form action={action} className="space-y-4">
        <input type="hidden" name="id" value={reservation.id} />
        <input
          type="hidden"
          name="pricePerNight"
          value={pricePerNightCalc.toFixed(2)}
        />
        <input type="hidden" name="payout" value={ownerPayout.toFixed(2)} />
        <input type="hidden" name="currency" value={reservation.currency || "AED"} />

        <div className="grid grid-cols-2 gap-3">
          <Field label={labels.guestName} htmlFor="guestName">
            <Input
              id="guestName"
              name="guestName"
              defaultValue={reservation.guestName ?? ""}
              placeholder="Full name"
              required
            />
          </Field>
          <Field label={labels.numGuests} htmlFor="numGuests">
            <Input
              id="numGuests"
              name="numGuests"
              type="number"
              min={0}
              defaultValue={reservation.numGuests || ""}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone" htmlFor="guestPhone">
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
              <Input
                id="guestPhone"
                name="guestPhone"
                defaultValue={reservation.guestPhone ?? ""}
                className="pl-9"
                placeholder="+971..."
              />
            </div>
          </Field>
          <Field label="Email" htmlFor="guestEmail">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
              <Input
                id="guestEmail"
                name="guestEmail"
                defaultValue={reservation.guestEmail ?? ""}
                className="pl-9"
                placeholder="guest@..."
              />
            </div>
          </Field>
        </div>

        <div className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
          <Field
            label={`${labels.totalPrice ?? "Amount"} (${labels.currency})`}
            htmlFor="totalPrice"
            hint={labels.amountHint ?? "Gross amount paid by guest"}
          >
            <Input
              id="totalPrice"
              name="totalPrice"
              type="number"
              step="0.01"
              min="0.01"
              required
              value={totalPriceStr}
              onChange={(e) => setTotalPriceStr(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={`${labels.agencyCommission ?? "Agency commission"} (${labels.currency})`}
              htmlFor="agencyCommission"
            >
              <Input
                id="agencyCommission"
                name="agencyCommission"
                type="number"
                step="0.01"
                min="0"
                placeholder="0"
                value={agencyCommissionStr}
                onChange={(e) => setAgencyCommissionStr(e.target.value)}
              />
            </Field>
            <Field
              label={`${labels.portalCommission ?? "Portal commission"} (${labels.currency})`}
              htmlFor="portalCommission"
            >
              <Input
                id="portalCommission"
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
          <div className="rounded-xl bg-[var(--color-brand-soft)] px-3 py-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-brand)]">
                {labels.payout ?? "Owner payout"}
              </span>
              <span className="text-lg font-bold text-[var(--color-brand)]">
                {formatCurrency(ownerPayout, reservation.currency || "AED", locale)}
              </span>
            </div>
            <div className="mt-0.5 text-[10px] text-[var(--color-brand)]/70">
              = {formatCurrency(totalPrice, reservation.currency || "AED", locale)} −{" "}
              {formatCurrency(agencyCommission, reservation.currency || "AED", locale)} −{" "}
              {formatCurrency(portalCommission, reservation.currency || "AED", locale)}
            </div>
          </div>
        </div>

        <input type="hidden" name="paid" value={paid ? "true" : "false"} />
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
              Tick once the guest has fully paid for this reservation.
            </div>
          </div>
        </label>

        <Field label="Bill into" htmlFor="bill-resv">
          <select
            id="bill-resv"
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

        <Field label={labels.notes} htmlFor="notes">
          <Textarea
            id="notes"
            name="notes"
            defaultValue={reservation.notes ?? ""}
            placeholder="Internal notes about this reservation..."
          />
        </Field>

        <ExtensionsSection
          reservationId={reservation.id}
          extensions={reservation.extensions}
          locale={locale}
          currency={reservation.currency || "AED"}
          fallbackCheckIn={reservation.checkOut}
        />

        {state?.status === "error" && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600">
            {state.message}
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onDelete(reservation.id)}
            loading={deletePending}
            className="text-rose-500 hover:bg-rose-500/10"
          >
            <Trash2 className="h-4 w-4" />
            {labels.delete}
          </Button>
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              {labels.cancel}
            </Button>
            <Button type="submit" loading={pending}>
              {labels.save}
            </Button>
          </div>
        </div>
      </form>
    </Sheet>
  );
}

function CompanyReservationCreator({
  open,
  properties,
  labels,
  locale,
  onClose,
}: {
  open: boolean;
  properties: { id: string; name: string; color: string }[];
  labels: Record<string, string>;
  locale: Locale;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<
    ReservationState | undefined,
    FormData
  >(createCompanyReservationAction, undefined);
  const [propertyId, setPropertyId] = useState<string>(
    properties[0]?.id ?? "",
  );
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [totalPriceStr, setTotalPriceStr] = useState("");
  const [agencyCommissionStr, setAgencyCommissionStr] = useState("");
  const [portalCommissionStr, setPortalCommissionStr] = useState("");
  const totalPrice = parseFloat(totalPriceStr) || 0;
  const agencyCommission = parseFloat(agencyCommissionStr) || 0;
  const portalCommission = parseFloat(portalCommissionStr) || 0;
  const [paid, setPaid] = useState(false);
  const monthOpts = monthOptions();
  const currentMonthKey =
    monthOpts.find((o) => o.label === monthLabel(new Date()))?.key ??
    monthOpts[6]?.key ??
    "";
  const [monthKey, setMonthKey] = useState<string>(currentMonthKey);

  useEffect(() => {
    if (state?.status === "ok") {
      router.refresh();
      onClose();
    }
  }, [state, onClose, router]);

  const nights =
    checkIn && checkOut
      ? Math.max(
          0,
          Math.round(
            (new Date(checkOut).getTime() - new Date(checkIn).getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : 0;
  const ownerPayout = Math.max(
    0,
    totalPrice - agencyCommission - portalCommission,
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={labels.newReservation ?? "New reservation"}
      description={
        labels.newReservationHint ??
        "Manual reservation for a property without an Airbnb listing."
      }
    >
      <form action={action} className="space-y-4">
        <Field label={labels.property ?? "Property"} htmlFor="propertyId">
          <select
            id="propertyId"
            name="propertyId"
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            required
            className="h-11 w-full rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-medium focus:border-[var(--color-brand)] focus:outline-none focus:ring-[3px] focus:ring-[var(--color-brand)]/25"
          >
            {properties.length === 0 ? (
              <option value="">— No properties —</option>
            ) : (
              properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))
            )}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={labels.checkIn} htmlFor="checkIn">
            <Input
              id="checkIn"
              name="checkIn"
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              required
            />
          </Field>
          <Field label={labels.checkOut} htmlFor="checkOut">
            <Input
              id="checkOut"
              name="checkOut"
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              required
            />
          </Field>
        </div>
        {nights > 0 && (
          <div className="text-xs text-[var(--color-muted)]">
            {nights} {nights === 1 ? "night" : "nights"}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label={labels.guestName} htmlFor="cr-guestName">
            <Input
              id="cr-guestName"
              name="guestName"
              placeholder="Full name"
              required
            />
          </Field>
          <Field label={labels.numGuests} htmlFor="cr-numGuests">
            <Input
              id="cr-numGuests"
              name="numGuests"
              type="number"
              min={0}
              defaultValue=""
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone" htmlFor="cr-guestPhone">
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
              <Input
                id="cr-guestPhone"
                name="guestPhone"
                className="pl-9"
                placeholder="+971..."
              />
            </div>
          </Field>
          <Field label="Email" htmlFor="cr-guestEmail">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
              <Input
                id="cr-guestEmail"
                name="guestEmail"
                className="pl-9"
                placeholder="guest@..."
              />
            </div>
          </Field>
        </div>

        <div className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
          <Field
            label={`${labels.totalPrice ?? "Amount"} (${labels.currency})`}
            htmlFor="cr-totalPrice"
            hint={labels.amountHint ?? "Gross amount paid by guest"}
          >
            <Input
              id="cr-totalPrice"
              name="totalPrice"
              type="number"
              step="0.01"
              min="0.01"
              required
              value={totalPriceStr}
              onChange={(e) => setTotalPriceStr(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={`${labels.agencyCommission ?? "Agency commission"} (${labels.currency})`}
              htmlFor="cr-agencyCommission"
            >
              <Input
                id="cr-agencyCommission"
                name="agencyCommission"
                type="number"
                step="0.01"
                min="0"
                value={agencyCommissionStr}
                onChange={(e) => setAgencyCommissionStr(e.target.value)}
              />
            </Field>
            <Field
              label={`${labels.portalCommission ?? "Portal commission"} (${labels.currency})`}
              htmlFor="cr-portalCommission"
            >
              <Input
                id="cr-portalCommission"
                name="portalCommission"
                type="number"
                step="0.01"
                min="0"
                value={portalCommissionStr}
                onChange={(e) => setPortalCommissionStr(e.target.value)}
              />
            </Field>
          </div>
          <div className="rounded-xl bg-[var(--color-brand-soft)] px-3 py-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-brand)]">
                {labels.payout ?? "Owner payout"}
              </span>
              <span className="text-lg font-bold text-[var(--color-brand)]">
                {formatCurrency(ownerPayout, "AED", locale)}
              </span>
            </div>
          </div>
        </div>

        <input type="hidden" name="paid" value={paid ? "true" : "false"} />
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
              Tick once the guest has fully paid for this reservation.
            </div>
          </div>
        </label>

        <Field label="Bill into" htmlFor="bill-cr">
          <select
            id="bill-cr"
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

        <Field label={labels.notes} htmlFor="cr-notes">
          <Textarea
            id="cr-notes"
            name="notes"
            placeholder="Internal notes about this reservation..."
          />
        </Field>

        {state?.status === "error" && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600">
            {state.message}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {labels.cancel}
          </Button>
          <Button type="submit" loading={pending}>
            {labels.save}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}



// Collapsible extensions block. Lives at the bottom of the reservation
// editor so it doesn't dominate the form. The summary header announces
// how many extensions exist + how many still need pricing; clicking
// expands the inline forms (one per extension + an Add slot). Native
// <details> handles the toggle so no extra state plumbing is needed.
function ExtensionsSection({
  reservationId,
  extensions,
  locale,
  currency,
  fallbackCheckIn,
}: {
  reservationId: string;
  extensions: ReservationExtensionItem[];
  locale: Locale;
  currency: string;
  fallbackCheckIn: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<
    ReservationExtensionItem | null | undefined
  >(undefined);
  const [deletePending, startDelete] = useTransition();
  const pendingCount = extensions.filter(
    (e) => !e.detailsFilled || e.totalPrice <= 0,
  ).length;

  return (
    <details className="group rounded-2xl border border-[var(--color-border)] bg-white open:bg-[var(--color-surface-2)]/40">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm">
        <span className="flex items-center gap-2">
          <CalendarPlus className="h-4 w-4 text-[var(--color-brand)]" />
          <span className="font-semibold">Extensions</span>
          {extensions.length > 0 && (
            <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-700">
              {extensions.length}
            </span>
          )}
          {pendingCount > 0 && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
              {pendingCount} need pricing
            </span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 text-[var(--color-muted)] transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-2 border-t border-[var(--color-border)] px-4 py-3">
        {extensions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--color-border)] px-3 py-4 text-center text-xs text-[var(--color-muted)]">
            No extensions yet. iCal sync adds them automatically when a
            stay's check-out grows; you can also add one manually below.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {extensions.map((ext) => {
              const needsPricing = !ext.detailsFilled || ext.totalPrice <= 0;
              return (
                <li
                  key={ext.id}
                  className={`flex items-start gap-3 rounded-xl border px-3 py-2 ${
                    needsPricing
                      ? "border-amber-500/30 bg-amber-500/5"
                      : "border-[var(--color-border)] bg-white"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                      {formatDate(ext.checkIn, locale)} →{" "}
                      {formatDate(ext.checkOut, locale)}
                      <span className="text-xs font-normal text-[var(--color-muted)]">
                        · {ext.nights} {ext.nights === 1 ? "night" : "nights"}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                      {ext.totalPrice > 0 ? (
                        <span className="font-semibold text-[var(--color-foreground)]">
                          {formatCurrency(
                            ext.totalPrice,
                            ext.currency || "AED",
                            locale,
                          )}
                        </span>
                      ) : (
                        <span className="font-semibold text-amber-700">
                          Needs pricing
                        </span>
                      )}
                      {ext.paid ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" />
                          Paid
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                          Unpaid
                        </span>
                      )}
                      {ext.monthKey && (
                        <span className="text-[10px] text-[var(--color-muted)]">
                          · {ext.monthKey}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditing(ext)}
                      aria-label="Edit extension"
                      className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-foreground)]"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={deletePending}
                      onClick={() => {
                        if (!confirm("Delete this extension?")) return;
                        startDelete(async () => {
                          await deleteReservationExtensionAction(ext.id);
                          router.refresh();
                        });
                      }}
                      aria-label="Delete extension"
                      className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex justify-end pt-1">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setEditing(null)}
          >
            <CalendarPlus className="h-4 w-4" />
            Add extension
          </Button>
        </div>
      </div>

      <ExtensionEditor
        key={editing === undefined ? "closed" : editing?.id ?? "new"}
        open={editing !== undefined}
        reservationId={reservationId}
        extension={editing ?? null}
        currency={currency}
        locale={locale}
        fallbackCheckIn={fallbackCheckIn}
        onClose={() => setEditing(undefined)}
      />
    </details>
  );
}

function ExtensionEditor({
  open,
  reservationId,
  extension,
  currency,
  locale,
  fallbackCheckIn,
  onClose,
}: {
  open: boolean;
  reservationId: string;
  extension: ReservationExtensionItem | null;
  currency: string;
  locale: Locale;
  fallbackCheckIn: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<
    ReservationExtensionState | undefined,
    FormData
  >(upsertReservationExtensionAction, undefined);

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
  const defaultMonth =
    extension?.monthKey ??
    (extension
      ? monthKeyFor(extension.checkIn)
      : monthOpts.find((o) => o.label === monthLabel(new Date()))?.key ??
        monthOpts[6]?.key ??
        "");
  const [monthKey, setMonthKey] = useState<string>(defaultMonth);

  useEffect(() => {
    if (state?.status === "ok") {
      router.refresh();
      onClose();
    }
  }, [state, onClose, router]);

  const totalPrice = parseFloat(totalPriceStr) || 0;
  const agencyCommission = parseFloat(agencyCommissionStr) || 0;
  const portalCommission = parseFloat(portalCommissionStr) || 0;
  const ownerPayout = Math.max(
    0,
    totalPrice - agencyCommission - portalCommission,
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={extension ? "Edit extension" : "New extension"}
      description={
        extension
          ? `${formatDate(extension.checkIn, locale)} → ${formatDate(extension.checkOut, locale)} · ${extension.nights} nights`
          : "Add-on stay window — captures the extra nights only."
      }
    >
      <form action={action} className="space-y-4">
        {extension && <input type="hidden" name="id" value={extension.id} />}
        <input type="hidden" name="reservationId" value={reservationId} />
        <input type="hidden" name="currency" value={currency} />
        <input type="hidden" name="paid" value={paid ? "true" : "false"} />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Check-in" htmlFor="ext-checkIn">
            <Input
              id="ext-checkIn"
              name="checkIn"
              type="date"
              required
              defaultValue={
                extension?.checkIn.slice(0, 10) ??
                fallbackCheckIn.slice(0, 10)
              }
            />
          </Field>
          <Field label="Check-out" htmlFor="ext-checkOut">
            <Input
              id="ext-checkOut"
              name="checkOut"
              type="date"
              required
              defaultValue={extension?.checkOut.slice(0, 10) ?? ""}
            />
          </Field>
        </div>

        <div className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
          <Field label={`Amount (${currency})`} htmlFor="ext-totalPrice">
            <Input
              id="ext-totalPrice"
              name="totalPrice"
              type="number"
              step="0.01"
              min="0"
              required
              value={totalPriceStr}
              onChange={(e) => setTotalPriceStr(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={`Agency commission (${currency})`}
              htmlFor="ext-agencyCommission"
            >
              <Input
                id="ext-agencyCommission"
                name="agencyCommission"
                type="number"
                step="0.01"
                min="0"
                placeholder="0"
                value={agencyCommissionStr}
                onChange={(e) => setAgencyCommissionStr(e.target.value)}
              />
            </Field>
            <Field
              label={`Portal commission (${currency})`}
              htmlFor="ext-portalCommission"
            >
              <Input
                id="ext-portalCommission"
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

        <Field label="Bill into" htmlFor="ext-monthKey">
          <select
            id="ext-monthKey"
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

        <Field label="Notes" htmlFor="ext-notes">
          <Textarea
            id="ext-notes"
            name="notes"
            defaultValue={extension?.notes ?? ""}
            placeholder="Internal notes about this extension..."
          />
        </Field>

        {state?.status === "error" && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600">
            {state.message}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={pending}>
            Save
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
