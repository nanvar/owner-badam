"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Locale } from "@/i18n/config";

export type UnpaidReservation = {
  id: string;
  kind: "reservation" | "extension";
  propertyName: string;
  propertyColor: string;
  guestName: string | null;
  checkIn: string;
  checkOut: string;
  totalPrice: number;
  currency: string;
};

// Clickable KPI tile for outstanding receivables. Opens a side drawer
// that lists every reservation + extension that still has money owed.
export function UnpaidCard({
  locale,
  total,
  count,
  reservations,
}: {
  locale: Locale;
  total: number;
  count: number;
  reservations: UnpaidReservation[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={count === 0}
        className="block h-full w-full text-left disabled:cursor-default"
      >
        <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
          <CardBody className="flex h-full flex-col gap-2 bg-gradient-to-br from-rose-500/15 to-rose-500/0 p-3.5! text-rose-600">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
                Unpaid · {count}
              </div>
              <AlertCircle className="h-4 w-4 opacity-80" />
            </div>
            <div className="text-lg font-bold tabular-nums text-[var(--color-foreground)]">
              {formatCurrency(total, "AED", locale)}
            </div>
          </CardBody>
        </Card>
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        side="right"
        title="Outstanding reservations"
        description={`${count} item${count === 1 ? "" : "s"} · ${formatCurrency(total, "AED", locale)} owed`}
      >
        {reservations.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--color-border)] bg-white px-4 py-10 text-center text-sm text-[var(--color-muted)]">
            All settled — every reservation in this period is fully paid.
          </p>
        ) : (
          <ul className="space-y-2">
            {reservations.map((r) => (
              <li
                key={`${r.kind}-${r.id}`}
                className="flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2.5"
              >
                <span
                  className="mt-1 h-7 w-1 shrink-0 rounded-full"
                  style={{ background: r.propertyColor }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">
                      {r.propertyName}
                    </span>
                    {r.kind === "extension" && (
                      <span className="rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-700">
                        Ext
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-[var(--color-muted)]">
                    {r.guestName ?? "—"} · {formatDate(r.checkIn, locale)} →{" "}
                    {formatDate(r.checkOut, locale)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold tabular-nums text-rose-600">
                    {formatCurrency(r.totalPrice, r.currency || "AED", locale)}
                  </div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Unpaid
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </>
  );
}
