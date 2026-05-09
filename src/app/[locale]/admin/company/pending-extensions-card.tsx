"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { formatDate } from "@/lib/utils";
import type { Locale } from "@/i18n/config";

export type PendingExtension = {
  id: string;
  propertyName: string;
  propertyColor: string;
  guestName: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
};

// Surfaces extensions captured by iCal sync that still need their
// price + commissions filled in. Click → opens a drawer listing them
// so the admin knows where to look.
export function PendingExtensionsCard({
  locale,
  count,
  extensions,
}: {
  locale: Locale;
  count: number;
  extensions: PendingExtension[];
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
          <CardBody className="flex h-full flex-col gap-2 bg-gradient-to-br from-amber-500/15 to-amber-500/0 p-3.5! text-amber-700">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
                Pending extensions
              </div>
              <CalendarPlus className="h-4 w-4 opacity-80" />
            </div>
            <div className="text-lg font-bold tabular-nums text-[var(--color-foreground)]">
              {count}
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
              {count === 0 ? "All priced" : "Needs pricing"}
            </div>
          </CardBody>
        </Card>
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        side="right"
        title="Extensions awaiting pricing"
        description={`${count} extension${count === 1 ? "" : "s"} from sync need amount + commissions filled in.`}
      >
        {extensions.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--color-border)] bg-white px-4 py-10 text-center text-sm text-[var(--color-muted)]">
            Nothing pending — every extension has its price entered.
          </p>
        ) : (
          <ul className="space-y-2">
            {extensions.map((ext) => (
              <li
                key={ext.id}
                className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5"
              >
                <span
                  className="mt-1 h-7 w-1 shrink-0 rounded-full"
                  style={{ background: ext.propertyColor }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {ext.propertyName}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-[var(--color-muted)]">
                    {ext.guestName ?? "—"} · {formatDate(ext.checkIn, locale)} →{" "}
                    {formatDate(ext.checkOut, locale)}
                    <span className="ml-1">
                      · {ext.nights} {ext.nights === 1 ? "night" : "nights"}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                    Open the reservation editor to enter the price.
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
