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
  upcomingRevenue: number;
  upcomingAgency: number;
  upcomingPortal: number;
  upcomingPayout: number;
};

// One card showing both company-side and owner-side upcoming amounts.
// Click reveals a drawer with the full per-property breakdown so admins
// can drill in without the dashboard becoming two separate tiles.
export function CombinedUpcomingTile({
  companyAmount,
  ownerAmount,
  totalBookings,
  rows,
  locale,
}: {
  companyAmount: number;
  ownerAmount: number;
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
        className="block h-full text-left transition-transform hover:-translate-y-0.5"
      >
        <Card className="h-full overflow-hidden ring-1 ring-transparent transition-shadow hover:ring-sky-300/60 hover:shadow-lg hover:shadow-sky-500/10">
          <CardBody className="flex h-full flex-col gap-2 bg-gradient-to-br from-sky-500/15 to-sky-500/0 !p-3.5 text-sky-700">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
                Upcoming
              </div>
              <div className="opacity-80">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                  Company
                </div>
                <div className="text-lg font-bold tabular-nums text-[var(--color-foreground)]">
                  {formatCurrency(companyAmount, "AED", locale)}
                </div>
              </div>
              <span className="h-8 w-px self-center bg-current opacity-15" />
              <div className="flex-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                  Owner
                </div>
                <div className="text-lg font-bold tabular-nums text-[var(--color-foreground)]">
                  {formatCurrency(ownerAmount, "AED", locale)}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        side="right"
        title="Upcoming"
        description={`${totalBookings} reservation${totalBookings === 1 ? "" : "s"} · company ${formatCurrency(companyAmount, "AED", locale)} · owner ${formatCurrency(ownerAmount, "AED", locale)}`}
      >
        {visibleRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-border)] py-10 text-center text-sm text-[var(--color-muted)]">
            No upcoming reservations.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)]">
            <table className="grid-table w-full text-sm">
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
                    Revenue
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    Company
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    Owner payout
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
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatCurrency(r.upcomingRevenue, "AED", locale)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums text-sky-700">
                      {formatCurrency(r.upcomingAgency, "AED", locale)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums text-indigo-700">
                      {formatCurrency(r.upcomingPayout, "AED", locale)}
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
