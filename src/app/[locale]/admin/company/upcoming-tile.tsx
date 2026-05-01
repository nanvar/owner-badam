"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { formatCurrency } from "@/lib/utils";
import type { Locale } from "@/i18n/config";

export type UpcomingRow = {
  id: string;
  name: string;
  color: string;
  ownerName: string;
  upcomingBookings: number;
  upcomingAgency: number;
};

export function UpcomingTile({
  totalAmount,
  totalBookings,
  rows,
  locale,
}: {
  totalAmount: number;
  totalBookings: number;
  rows: UpcomingRow[];
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);
  const visibleRows = rows.filter((r) => r.upcomingBookings > 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-left transition-transform hover:-translate-y-0.5"
      >
        <Card className="overflow-hidden ring-1 ring-transparent transition-shadow hover:ring-sky-300/60 hover:shadow-lg hover:shadow-sky-500/10">
          <CardBody className="bg-gradient-to-br from-sky-500/15 to-sky-500/0 text-sky-700">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
                Upcoming amount
              </div>
              <div className="opacity-80">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-1.5 text-xl font-bold tabular-nums text-[var(--color-foreground)]">
              {formatCurrency(totalAmount, "AED", locale)}
            </div>
            <div className="mt-0.5 text-[11px] text-[var(--color-muted)]">
              {totalBookings} pipeline · click for details
            </div>
          </CardBody>
        </Card>
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        side="right"
        title="Upcoming reporting"
        description={`${totalBookings} reservation${totalBookings === 1 ? "" : "s"} · ${formatCurrency(totalAmount, "AED", locale)} expected`}
      >
        {visibleRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-border)] py-10 text-center text-sm text-[var(--color-muted)]">
            No upcoming reservations.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface-2)] text-xs uppercase tracking-wider text-[var(--color-muted)]">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold">
                    Property
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold">Owner</th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    Bookings
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-[var(--color-border)]"
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-6 w-1 shrink-0 rounded-full"
                          style={{ background: r.color }}
                        />
                        <span className="font-semibold">{r.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-muted)]">
                      {r.ownerName}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {r.upcomingBookings}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums text-sky-600">
                      {formatCurrency(r.upcomingAgency, "AED", locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Sheet>
    </>
  );
}
