"use client";

import { useState } from "react";
import { AlertCircle, Building2, User } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Locale } from "@/i18n/config";

export type UnpaidReservation = {
  id: string;
  kind: "reservation" | "extension";
  propertyName: string;
  propertyColor: string;
  managementOnly: boolean;
  guestName: string | null;
  checkIn: string;
  checkOut: string;
  totalPrice: number;
  // Slice of `totalPrice` that would go to the owner if the guest
  // paid. Already zeroed at the page layer for management-only units.
  payout: number;
  currency: string;
};

// Clickable KPI tile for outstanding receivables. The headline number is
// the total unpaid; underneath it, a thin two-column row splits the
// total into the COMPANY slice (agency + portal commissions) and the
// OWNER slice (would-be payout). Same split surfaces in the drawer:
// each row exposes Company / Owner sub-amounts so admins can tell at a
// glance how much of each unpaid booking is theirs vs the owner's.
export function UnpaidCard({
  locale,
  total,
  ownerTotal,
  companyTotal,
  count,
  reservations,
}: {
  locale: Locale;
  total: number;
  ownerTotal: number;
  companyTotal: number;
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
            {/* Split sub-row — only show when there's something to
                split so empty / zero states stay clean. */}
            {total > 0 && (
              <div className="mt-auto grid grid-cols-2 gap-1.5 pt-0.5">
                <SplitChip
                  icon={<Building2 className="h-3 w-3" />}
                  label="Company"
                  value={formatCurrency(companyTotal, "AED", locale)}
                  tone="company"
                />
                <SplitChip
                  icon={<User className="h-3 w-3" />}
                  label="Owner"
                  value={formatCurrency(ownerTotal, "AED", locale)}
                  tone="owner"
                />
              </div>
            )}
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
          <>
            {/* Drawer header totals: mirror the tile's split so the
                drawer reads as a deeper-dive of the same data, not a
                different metric. */}
            <div className="mb-3 grid grid-cols-3 gap-2">
              <DrawerStat
                label="Total"
                value={formatCurrency(total, "AED", locale)}
                tone="rose"
              />
              <DrawerStat
                label="Company"
                value={formatCurrency(companyTotal, "AED", locale)}
                tone="indigo"
              />
              <DrawerStat
                label="Owner"
                value={formatCurrency(ownerTotal, "AED", locale)}
                tone="emerald"
              />
            </div>
            <ul className="space-y-2">
              {reservations.map((r) => {
                const companyShare = r.totalPrice - r.payout;
                return (
                  <li
                    key={`${r.kind}-${r.id}`}
                    className="rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2.5"
                  >
                    <div className="flex items-start gap-3">
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
                          {r.managementOnly && (
                            <span className="rounded-full bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                              Mgmt
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
                    </div>
                    {/* Per-row split — only when there IS an owner share
                        (skip for management-only). */}
                    {!r.managementOnly && (
                      <div className="mt-2 grid grid-cols-2 gap-2 border-t border-[var(--color-border)]/60 pt-2">
                        <RowSplit
                          icon={<Building2 className="h-3 w-3" />}
                          label="Company"
                          value={formatCurrency(
                            companyShare,
                            r.currency || "AED",
                            locale,
                          )}
                          tone="indigo"
                        />
                        <RowSplit
                          icon={<User className="h-3 w-3" />}
                          label="Owner"
                          value={formatCurrency(
                            r.payout,
                            r.currency || "AED",
                            locale,
                          )}
                          tone="emerald"
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Sheet>
    </>
  );
}

function SplitChip({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "company" | "owner";
}) {
  const tonePill =
    tone === "company"
      ? "bg-indigo-500/15 text-indigo-700"
      : "bg-emerald-500/15 text-emerald-700";
  return (
    <div className={`rounded-lg px-1.5 py-1 ${tonePill}`}>
      <div className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider opacity-90">
        {icon}
        {label}
      </div>
      <div className="text-[11px] font-bold tabular-nums text-[var(--color-foreground)]">
        {value}
      </div>
    </div>
  );
}

function DrawerStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "rose" | "indigo" | "emerald";
}) {
  const toneClass =
    tone === "rose"
      ? "bg-rose-500/10 text-rose-700"
      : tone === "indigo"
        ? "bg-indigo-500/10 text-indigo-700"
        : "bg-emerald-500/10 text-emerald-700";
  return (
    <div className={`rounded-xl p-2 text-center ${toneClass}`}>
      <div className="text-[9px] font-semibold uppercase tracking-wider opacity-80">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-bold tabular-nums">{value}</div>
    </div>
  );
}

function RowSplit({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "indigo" | "emerald";
}) {
  const toneClass =
    tone === "indigo"
      ? "text-indigo-700"
      : "text-emerald-700";
  return (
    <div className="flex items-center justify-between gap-1.5 rounded-lg bg-[var(--color-surface-2)]/60 px-2 py-1">
      <span className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider ${toneClass}`}>
        {icon}
        {label}
      </span>
      <span className={`text-[11px] font-bold tabular-nums ${toneClass}`}>
        {value}
      </span>
    </div>
  );
}
