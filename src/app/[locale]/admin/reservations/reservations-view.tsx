"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Trash2,
  Phone,
  Mail,
  Search,
  RefreshCw,
  AlertTriangle,
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
  rawSummary: string | null;
};

export function ReservationsView({
  locale,
  items,
  labels,
}: {
  locale: Locale;
  items: Item[];
  labels: Record<string, string>;
}) {
  const [filter, setFilter] = useState<"incomplete" | "complete">("incomplete");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Item | null>(null);
  const [deletePending, startDelete] = useTransition();
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [syncPending, startSync] = useTransition();

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (filter === "incomplete" && i.detailsFilled) return false;
      if (filter === "complete" && !i.detailsFilled) return false;
      if (search) {
        const q = search.toLowerCase();
        const blob = `${i.guestName ?? ""} ${i.propertyName} ${i.rawSummary ?? ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [items, filter, search]);
  const incompleteCount = useMemo(
    () => items.filter((i) => !i.detailsFilled).length,
    [items],
  );
  const completeCount = items.length - incompleteCount;

  return (
    <div>
      <PageHeader
        title={labels.title}
        right={
          <Button
            variant="secondary"
            loading={syncPending}
            onClick={() =>
              startSync(async () => {
                const r = await syncAllAction();
                setSyncState(r);
              })
            }
          >
            <RefreshCw className="h-4 w-4" />
            {syncPending ? labels.syncing : labels.syncNow}
          </Button>
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
          {(["incomplete", "complete"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                filter === f
                  ? "bg-[var(--color-brand)] text-white"
                  : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              {f === "incomplete" ? labels.incomplete : labels.complete}
              <span
                className={`rounded-full px-1.5 text-[10px] font-bold ${
                  filter === f
                    ? "bg-white/25 text-white"
                    : "bg-[var(--color-surface-2)] text-[var(--color-muted)]"
                }`}
              >
                {f === "incomplete" ? incompleteCount : completeCount}
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
                      {r.detailsFilled ? (
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
        reservation={editing}
        labels={labels}
        locale={locale}
        onClose={() => setEditing(null)}
        onDelete={(id) =>
          startDelete(async () => {
            await deleteReservationAction(id);
            setEditing(null);
          })
        }
        deletePending={deletePending}
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

  if (state?.status === "ok" && reservation) {
    queueMicrotask(onClose);
  }

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
