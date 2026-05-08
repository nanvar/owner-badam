"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/app-shell";
import { formatCurrency, formatDate } from "@/lib/utils";
import { deleteReservationAction } from "@/app/actions/reservations";
import {
  ReservationEditor,
  type ReservationItem,
} from "../reservations-view";
import type { Locale } from "@/i18n/config";

export function IncompleteReservationsView({
  locale,
  items,
  backHref,
  labels,
}: {
  locale: Locale;
  items: ReservationItem[];
  backHref: string;
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<ReservationItem | null>(null);
  const [deletePending, startDelete] = useTransition();

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
        These reservations were synced from Airbnb but still need their amounts
        and guest details filled in before they show up in reports.
      </div>

      {items.length === 0 ? (
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
                {items.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setEditing(r)}
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
                    <td className="px-4 py-3">{r.guestName ?? "—"}</td>
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
    </div>
  );
}
