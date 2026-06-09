"use client";

// Clickable "Owner payout" KPI for the company dashboard. Visually
// identical to the static KpiTile next to it; tapping opens a right
// drawer with the per-owner outstanding breakdown so admins can see at
// a glance how much they still owe each owner and on which property.

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Users, X, ChevronRight, AlertCircle } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { Locale } from "@/i18n/config";

type Property = {
  id: string;
  name: string;
  color: string;
  outstanding: number;
};

type Owner = {
  ownerId: string;
  ownerName: string;
  total: number;
  properties: Property[];
};

export function OwnerPayoutCard({
  locale,
  total,
  ownerCount,
  breakdown,
}: {
  locale: Locale;
  total: number;
  ownerCount: number;
  breakdown: Owner[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Trigger — same Card / CardBody shape as the neighbouring static
          KpiTile in company/page.tsx so the row stays visually uniform. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-full w-full text-left"
      >
        <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
          <CardBody className="flex h-full flex-col gap-2 bg-gradient-to-br from-indigo-500/15 to-indigo-500/0 !p-3.5 text-indigo-700">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
                Owner payout
                {ownerCount > 0 &&
                  ` · ${ownerCount} owner${ownerCount === 1 ? "" : "s"}`}
              </div>
              <div className="opacity-80">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="text-lg font-bold tabular-nums text-[var(--color-foreground)]">
              {formatCurrency(total, "AED", locale)}
            </div>
          </CardBody>
        </Card>
      </button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[80] flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 360, damping: 36 }}
              className="relative flex h-full w-full max-w-md flex-col bg-[var(--color-surface)] shadow-2xl"
            >
              <div className="shrink-0 border-b border-[var(--color-border)] bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                      Outstanding payouts
                    </div>
                    <div className="mt-1 truncate text-lg font-bold">
                      Owed to owners
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close"
                    className="grid h-8 w-8 place-items-center rounded-lg text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Stat
                    label="Total"
                    value={formatCurrency(total, "AED", locale)}
                    tone={total >= 0 ? "indigo" : "rose"}
                  />
                  <Stat label="Owners" value={String(ownerCount)} />
                </div>
                <div className="mt-2 text-[11px] text-[var(--color-muted)]">
                  Items inside an already-paid report are excluded. Negative
                  rows mean the owner owes the company.
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {breakdown.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--color-surface-2)] text-[var(--color-muted)]">
                      <Users className="h-5 w-5" />
                    </span>
                    <div className="text-sm font-medium">All settled</div>
                    <div className="text-xs text-[var(--color-muted)]">
                      Every owner is paid up for this period.
                    </div>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {breakdown.map((o) => {
                      const negative = o.total < 0;
                      return (
                        <li
                          key={o.ownerId}
                          className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white"
                        >
                          <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/40 px-3 py-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-bold">
                                {o.ownerName}
                              </div>
                              <div className="text-[10px] text-[var(--color-muted)]">
                                {o.properties.length}{" "}
                                {o.properties.length === 1 ? "property" : "properties"}
                              </div>
                            </div>
                            <div
                              className={
                                negative
                                  ? "shrink-0 text-base font-bold tabular-nums text-rose-600"
                                  : "shrink-0 text-base font-bold tabular-nums text-indigo-700"
                              }
                            >
                              {formatCurrency(o.total, "AED", locale)}
                            </div>
                          </div>
                          <ul className="divide-y divide-[var(--color-border)]">
                            {o.properties.map((p) => {
                              const neg = p.outstanding < 0;
                              return (
                                <li
                                  key={p.id}
                                  className="flex items-center gap-3 px-3 py-2"
                                >
                                  <span
                                    className="h-6 w-1 shrink-0 rounded-full"
                                    style={{ background: p.color }}
                                  />
                                  <div className="min-w-0 flex-1 truncate text-xs font-medium">
                                    {p.name}
                                  </div>
                                  {neg && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] text-rose-600">
                                      <AlertCircle className="h-3 w-3" />
                                      owes
                                    </span>
                                  )}
                                  <div
                                    className={
                                      neg
                                        ? "shrink-0 text-sm font-bold tabular-nums text-rose-600"
                                        : "shrink-0 text-sm font-bold tabular-nums text-indigo-700"
                                    }
                                  >
                                    {formatCurrency(p.outstanding, "AED", locale)}
                                  </div>
                                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--color-muted)] opacity-50" />
                                </li>
                              );
                            })}
                          </ul>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "indigo" | "rose";
}) {
  const toneClass =
    tone === "indigo"
      ? "bg-indigo-500/10 text-indigo-700"
      : tone === "rose"
        ? "bg-rose-500/10 text-rose-600"
        : "bg-[var(--color-surface-2)]";
  return (
    <div className={`rounded-xl p-2 text-center ${toneClass}`}>
      <div className="text-[9px] font-semibold uppercase tracking-wider opacity-80">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-bold tabular-nums">{value}</div>
    </div>
  );
}
