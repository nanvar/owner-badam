"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/app-shell";
import { formatCurrency, formatDate } from "@/lib/utils";
import { deleteReservationAction } from "@/app/actions/reservations";
import { deleteReservationExtensionAction } from "@/app/actions/reservation-extensions";
import {
  ReservationEditor,
  ExtensionEditor,
  type ReservationItem,
  type ReservationExtensionItem,
} from "../reservations-view";
import type { Locale } from "@/i18n/config";

type Row =
  | {
      kind: "reservation";
      id: string;
      raw: ReservationItem;
      propertyName: string;
      propertyColor: string;
      guestName: string | null;
      checkIn: string;
      checkOut: string;
      nights: number;
      totalPrice: number;
      currency: string;
    }
  | {
      kind: "extension";
      id: string;
      raw: ReservationExtensionItem;
      propertyName: string;
      propertyColor: string;
      guestName: string | null;
      checkIn: string;
      checkOut: string;
      nights: number;
      totalPrice: number;
      currency: string;
    };

export function IncompleteReservationsView({
  locale,
  items,
  extensions,
  backHref,
  labels,
}: {
  locale: Locale;
  items: ReservationItem[];
  extensions: ReservationExtensionItem[];
  backHref: string;
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<ReservationItem | null>(null);
  const [editingExt, setEditingExt] = useState<ReservationExtensionItem | null>(
    null,
  );
  const [deletePending, startDelete] = useTransition();
  const [extDeletePending, startExtDelete] = useTransition();

  // Merge reservations + extensions into one feed so admins fill them
  // in side-by-side. Extensions show a badge so the distinction stays
  // visible at a glance.
  const rows = useMemo<Row[]>(() => {
    const resRows: Row[] = items.map((r) => ({
      kind: "reservation",
      id: r.id,
      raw: r,
      propertyName: r.propertyName,
      propertyColor: r.propertyColor,
      guestName: r.guestName,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      nights: r.nights,
      totalPrice: r.totalPrice,
      currency: r.currency,
    }));
    const extRows: Row[] = extensions.map((e) => ({
      kind: "extension",
      id: e.id,
      raw: e,
      propertyName: e.propertyName,
      propertyColor: e.propertyColor,
      guestName: e.parentGuestName,
      checkIn: e.checkIn,
      checkOut: e.checkOut,
      nights: e.nights,
      totalPrice: e.totalPrice,
      currency: e.currency,
    }));
    return [...resRows, ...extRows].sort((a, b) =>
      b.checkIn.localeCompare(a.checkIn),
    );
  }, [items, extensions]);

  return (
    <div>
      <PageHeader
        title="Incomplete reservations"
        right={
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--color-muted)] transition-colors hover:border-[var(--color-brand)]/40 hover:text-[var(--color-brand)]"
          >
            <ArrowLeft className="h-4 w-4" />
            All reservations
          </Link>
        }
      />

      <div className="mb-4 flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
        <AlertCircle className="h-4 w-4 shrink-0" />
        These bookings were synced from Airbnb but still need their amounts
        and guest details filled in before they show up in reports.
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardBody className="py-12 text-center text-sm text-[var(--color-muted)]">
            All caught up — every reservation has its details filled.
          </CardBody>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="grid-table w-full text-sm">
              <thead className="bg-[var(--color-surface-2)] text-xs uppercase tracking-wider text-[var(--color-muted)]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">{labels.property}</th>
                  <th className="px-4 py-3 text-left font-semibold">{labels.guestName}</th>
                  <th className="px-4 py-3 text-left font-semibold">{labels.checkIn}</th>
                  <th className="px-4 py-3 text-left font-semibold">{labels.checkOut}</th>
                  <th className="px-4 py-3 text-right font-semibold">{labels.nights}</th>
                  <th className="px-4 py-3 text-right font-semibold">{labels.totalPrice}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={`${r.kind}-${r.id}`}
                    onClick={() =>
                      r.kind === "reservation"
                        ? setEditing(r.raw)
                        : setEditingExt(r.raw)
                    }
                    className="cursor-pointer border-t border-[var(--color-border)] bg-amber-500/5 hover:bg-amber-500/10"
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
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span>{r.guestName ?? "—"}</span>
                        {r.kind === "extension" && (
                          <span className="inline-flex items-center rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-700">
                            Extension
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDate(r.checkIn, locale)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDate(r.checkOut, locale)}
                    </td>
                    <td className="px-4 py-3 text-right">{r.nights}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {r.totalPrice > 0
                        ? formatCurrency(r.totalPrice, r.currency || "AED", locale)
                        : "—"}
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

      <ExtensionEditor
        key={editingExt?.id ?? "ext-empty"}
        open={!!editingExt}
        extension={editingExt}
        locale={locale}
        currency={editingExt?.currency || "AED"}
        onClose={() => setEditingExt(null)}
        onDelete={(id) =>
          startExtDelete(async () => {
            await deleteReservationExtensionAction(id);
            setEditingExt(null);
            router.refresh();
          })
        }
        deletePending={extDeletePending}
      />
    </div>
  );
}
