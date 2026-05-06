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

type Variant = "company" | "owner";

const variantStyle: Record<
  Variant,
  {
    label: string;
    drawerTitle: string;
    cardClasses: string;
    bodyClasses: string;
    ringClasses: string;
  }
> = {
  company: {
    label: "Upcoming",
    drawerTitle: "Upcoming",
    cardClasses: "hover:ring-sky-300/60 hover:shadow-sky-500/10",
    bodyClasses: "from-sky-500/15 to-sky-500/0 text-sky-700",
    ringClasses: "",
  },
  owner: {
    label: "Owner upcoming",
    drawerTitle: "Owner upcoming",
    cardClasses: "hover:ring-indigo-300/60 hover:shadow-indigo-500/10",
    bodyClasses: "from-indigo-500/15 to-indigo-500/0 text-indigo-700",
    ringClasses: "",
  },
};

export function UpcomingTile({
  variant = "company",
  totalAmount,
  totalBookings,
  rows,
  locale,
}: {
  variant?: Variant;
  totalAmount: number;
  totalBookings: number;
  rows: UpcomingRow[];
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);
  const style = variantStyle[variant];
  const visibleRows = rows.filter((r) => r.upcomingBookings > 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block h-full text-left transition-transform hover:-translate-y-0.5"
      >
        <Card
          className={`h-full overflow-hidden ring-1 ring-transparent transition-shadow hover:shadow-lg ${style.cardClasses}`}
        >
          <CardBody
            className={`flex h-full flex-col gap-2 bg-gradient-to-br !p-3.5 ${style.bodyClasses}`}
          >
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
                {style.label}
              </div>
              <div className="opacity-80">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="text-lg font-bold tabular-nums text-[var(--color-foreground)]">
              {formatCurrency(totalAmount, "AED", locale)}
            </div>
          </CardBody>
        </Card>
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        side="right"
        title={style.drawerTitle}
        description={`${totalBookings} reservation${totalBookings === 1 ? "" : "s"} · ${formatCurrency(totalAmount, "AED", locale)} expected`}
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
                    Portal
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
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums text-sky-600">
                      {formatCurrency(r.upcomingAgency, "AED", locale)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[var(--color-muted)]">
                      {formatCurrency(r.upcomingPortal, "AED", locale)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
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
