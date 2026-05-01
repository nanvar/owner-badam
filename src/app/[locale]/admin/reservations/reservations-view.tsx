"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Phone,
  Mail,
  Search,
  RefreshCw,
  AlertTriangle,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input, Field, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { PageHeader } from "@/components/app-shell";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  updateReservationAction,
  deleteReservationAction,
  createCompanyReservationAction,
  type ReservationState,
} from "@/app/actions/reservations";
import { syncAllAction, type SyncState } from "@/app/actions/sync";
import { SyncSummary } from "../properties-view";
import type { Locale } from "@/i18n/config";

type Item = {
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
  upcoming: boolean;
  rawSummary: string | null;
};

export function ReservationsView({
  locale,
  items,
  properties,
  labels,
}: {
  locale: Locale;
  items: Item[];
  properties: { id: string; name: string; color: string }[];
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<"incomplete" | "complete" | "upcoming">(
    "incomplete",
  );
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Item | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletePending, startDelete] = useTransition();
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [syncPending, startSync] = useTransition();

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (filter === "upcoming" && !i.upcoming) return false;
      if (filter === "incomplete" && (i.detailsFilled || i.upcoming))
        return false;
      if (filter === "complete" && (!i.detailsFilled || i.upcoming))
        return false;
      if (search) {
        const q = search.toLowerCase();
        const blob = `${i.guestName ?? ""} ${i.propertyName} ${i.rawSummary ?? ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [items, filter, search]);
  const upcomingCount = useMemo(
    () => items.filter((i) => i.upcoming).length,
    [items],
  );
  const incompleteCount = useMemo(
    () => items.filter((i) => !i.detailsFilled && !i.upcoming).length,
    [items],
  );
  const completeCount = useMemo(
    () => items.filter((i) => i.detailsFilled && !i.upcoming).length,
    [items],
  );

  return (
    <div>
      <PageHeader
        title={labels.title}
        right={
          <div className="flex items-center gap-2">
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
        <div className="ml-auto flex rounded-xl border border-[var(--color-border)] bg-white p-1">
          {(["incomplete", "complete", "upcoming"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                filter === f
                  ? "bg-[var(--color-brand)] text-white"
                  : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              {f === "incomplete"
                ? labels.incomplete
                : f === "complete"
                  ? labels.complete
                  : (labels.upcoming ?? "Upcoming")}
              <span
                className={`rounded-full px-1.5 text-[10px] font-bold ${
                  filter === f
                    ? "bg-white/25 text-white"
                    : "bg-[var(--color-surface-2)] text-[var(--color-muted)]"
                }`}
              >
                {f === "incomplete"
                  ? incompleteCount
                  : f === "complete"
                    ? completeCount
                    : upcomingCount}
              </span>
            </button>
          ))}
        </div>
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
            <table className="w-full text-sm">
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
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setEditing(r)}
                    className="cursor-pointer border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]/60"
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
                      {r.upcoming ? (
                        <Badge tone="info">
                          <Clock className="h-3 w-3" />
                          {labels.upcoming ?? "Upcoming"}
                        </Badge>
                      ) : r.detailsFilled ? (
                        <Badge tone="success">
                          <CheckCircle2 className="h-3 w-3" />
                          {labels.complete}
                        </Badge>
                      ) : (
                        <Badge tone="warning">
                          <AlertCircle className="h-3 w-3" />
                          {labels.incomplete}
                        </Badge>
                      )}
                    </td>
                  </tr>
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

function ReservationEditor({
  reservation,
  labels,
  locale,
  onClose,
  onDelete,
  deletePending,
}: {
  reservation: Item | null;
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
  const [totalPrice, setTotalPrice] = useState<number>(reservation?.totalPrice ?? 0);
  const [agencyCommission, setAgencyCommission] = useState<number>(
    reservation?.agencyCommission ?? 0,
  );
  const [portalCommission, setPortalCommission] = useState<number>(
    reservation?.portalCommission ?? 0,
  );
  const [upcoming, setUpcoming] = useState<boolean>(
    reservation?.upcoming ?? false,
  );

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
        <input
          type="hidden"
          name="upcoming"
          value={upcoming ? "true" : "false"}
        />

        <label
          className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition-colors ${
            upcoming
              ? "border-sky-500/40 bg-sky-500/10"
              : "border-[var(--color-border)] bg-white hover:border-[var(--color-brand)]/40"
          }`}
        >
          <input
            type="checkbox"
            checked={upcoming}
            onChange={(e) => setUpcoming(e.target.checked)}
            className="mt-1 h-4 w-4 accent-sky-500"
          />
          <div className="flex-1 text-sm">
            <div className="flex items-center gap-1.5 font-semibold">
              <Clock className="h-3.5 w-3.5 text-sky-500" />
              {labels.upcoming ?? "Upcoming"}
            </div>
            <div className="mt-0.5 text-xs text-[var(--color-muted)]">
              {labels.upcomingHint ??
                "Mark as future / not yet paid. Counted as pipeline (not realized) revenue."}
            </div>
          </div>
        </label>

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
              value={totalPrice || ""}
              onChange={(e) => setTotalPrice(parseFloat(e.target.value) || 0)}
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
                required
                value={agencyCommission || ""}
                onChange={(e) =>
                  setAgencyCommission(parseFloat(e.target.value) || 0)
                }
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
                required
                value={portalCommission || ""}
                onChange={(e) =>
                  setPortalCommission(parseFloat(e.target.value) || 0)
                }
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
          <details className="text-xs">
            <summary className="cursor-pointer select-none font-medium text-[var(--color-muted)]">
              {labels.advancedFees ?? "Advanced fees (cleaning, taxes…)"}
            </summary>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Field label={`${labels.cleaningFee} (${labels.currency})`} htmlFor="cleaningFee">
                <Input
                  id="cleaningFee"
                  name="cleaningFee"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={reservation.cleaningFee || ""}
                />
              </Field>
              <Field label={`${labels.serviceFee} (${labels.currency})`} htmlFor="serviceFee">
                <Input
                  id="serviceFee"
                  name="serviceFee"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={reservation.serviceFee || ""}
                />
              </Field>
              <Field label={`${labels.taxes} (${labels.currency})`} htmlFor="taxes">
                <Input
                  id="taxes"
                  name="taxes"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={reservation.taxes || ""}
                />
              </Field>
            </div>
          </details>
        </div>

        <Field label={labels.notes} htmlFor="notes">
          <Textarea
            id="notes"
            name="notes"
            defaultValue={reservation.notes ?? ""}
            placeholder="Internal notes about this reservation..."
          />
        </Field>

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
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const [agencyCommission, setAgencyCommission] = useState<number>(0);
  const [portalCommission, setPortalCommission] = useState<number>(0);
  const [upcoming, setUpcoming] = useState(false);

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
        <input
          type="hidden"
          name="upcoming"
          value={upcoming ? "true" : "false"}
        />

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
              value={totalPrice || ""}
              onChange={(e) => setTotalPrice(parseFloat(e.target.value) || 0)}
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
                value={agencyCommission || ""}
                onChange={(e) =>
                  setAgencyCommission(parseFloat(e.target.value) || 0)
                }
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
                value={portalCommission || ""}
                onChange={(e) =>
                  setPortalCommission(parseFloat(e.target.value) || 0)
                }
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
          <details className="text-xs">
            <summary className="cursor-pointer select-none font-medium text-[var(--color-muted)]">
              {labels.advancedFees ?? "Advanced fees (cleaning, taxes…)"}
            </summary>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Field
                label={`${labels.cleaningFee} (${labels.currency})`}
                htmlFor="cr-cleaningFee"
              >
                <Input
                  id="cr-cleaningFee"
                  name="cleaningFee"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue=""
                />
              </Field>
              <Field
                label={`${labels.serviceFee} (${labels.currency})`}
                htmlFor="cr-serviceFee"
              >
                <Input
                  id="cr-serviceFee"
                  name="serviceFee"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue=""
                />
              </Field>
              <Field label={`${labels.taxes} (${labels.currency})`} htmlFor="cr-taxes">
                <Input
                  id="cr-taxes"
                  name="taxes"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue=""
                />
              </Field>
            </div>
          </details>
        </div>

        <label
          className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition-colors ${
            upcoming
              ? "border-sky-500/40 bg-sky-500/10"
              : "border-[var(--color-border)] bg-white hover:border-[var(--color-brand)]/40"
          }`}
        >
          <input
            type="checkbox"
            checked={upcoming}
            onChange={(e) => setUpcoming(e.target.checked)}
            className="mt-1 h-4 w-4 accent-sky-500"
          />
          <div className="flex-1 text-sm">
            <div className="flex items-center gap-1.5 font-semibold">
              <Clock className="h-3.5 w-3.5 text-sky-500" />
              {labels.upcoming ?? "Upcoming"}
            </div>
            <div className="mt-0.5 text-xs text-[var(--color-muted)]">
              {labels.upcomingHint}
            </div>
          </div>
        </label>

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
