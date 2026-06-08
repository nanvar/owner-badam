"use client";

// Clickable dashboard KPI tile for "Paid to owner". Shows the running
// total of OwnerPayments in the selected period; tapping the tile opens
// a right-side drawer with the per-owner breakdown (totals + every
// individual payment with date / method / reference).

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  HandCoins,
  X,
  Wallet,
  Banknote,
  CreditCard,
  ArrowRightLeft,
  Calendar,
  ExternalLink,
  ScrollText,
  Send,
  Smartphone,
  Bitcoin,
  Globe2,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardBody } from "@/components/ui/card";
import type { Locale } from "@/i18n/config";

type Payment = {
  id: string;
  amount: number;
  date: string;
  method: string | null;
  reference: string | null;
  propertyName: string | null;
  propertyColor: string | null;
  reportId: string | null;
};

type Breakdown = {
  ownerId: string;
  ownerName: string;
  total: number;
  payments: Payment[];
};

// Curated labels for the known preset methods; anything else (custom)
// falls back to a title-cased slug so the drawer never shows raw values
// like "western_union" or "in_kind".
const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  wire: "Wire",
  card: "Card",
  cheque: "Cheque",
  paypal: "PayPal",
  stripe: "Stripe",
  western_union: "Western Union",
  crypto: "Crypto",
};

function methodLabel(m: string | null): string {
  if (!m) return "—";
  if (METHOD_LABELS[m]) return METHOD_LABELS[m];
  return m
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function methodIcon(m: string | null): React.ReactNode {
  switch (m) {
    case "cash":
      return <Banknote className="h-3.5 w-3.5" />;
    case "bank_transfer":
      return <ArrowRightLeft className="h-3.5 w-3.5" />;
    case "wire":
      return <Send className="h-3.5 w-3.5" />;
    case "card":
    case "stripe":
      return <CreditCard className="h-3.5 w-3.5" />;
    case "cheque":
      return <ScrollText className="h-3.5 w-3.5" />;
    case "paypal":
      return <Smartphone className="h-3.5 w-3.5" />;
    case "western_union":
      return <Globe2 className="h-3.5 w-3.5" />;
    case "crypto":
      return <Bitcoin className="h-3.5 w-3.5" />;
    default:
      return <Wallet className="h-3.5 w-3.5" />;
  }
}

export function PaidToOwnerCard({
  locale,
  total,
  paymentCount,
  ownerCount,
  breakdown,
}: {
  locale: Locale;
  total: number;
  paymentCount: number;
  ownerCount: number;
  breakdown: Breakdown[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Trigger — mirrors the static KpiTile in company/page.tsx so the
          dashboard row stays visually uniform. Wrapped in a plain button
          for the click handler; the Card primitive keeps the same
          border, radius, gradient and typography as its neighbours. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-full w-full text-left"
      >
        <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
          <CardBody className="flex h-full flex-col gap-2 bg-gradient-to-br from-emerald-500/15 to-emerald-500/0 !p-3.5 text-emerald-700">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
                Paid to owner
                {paymentCount > 0 &&
                  ` · ${paymentCount} payment${paymentCount === 1 ? "" : "s"}`}
              </div>
              <div className="opacity-80">
                <HandCoins className="h-4 w-4" />
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
              {/* Header */}
              <div className="shrink-0 border-b border-[var(--color-border)] bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                      Settlement breakdown
                    </div>
                    <div className="mt-1 truncate text-lg font-bold">
                      Paid to owners
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

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Stat
                    label="Total"
                    value={formatCurrency(total, "AED", locale)}
                    tone="emerald"
                  />
                  <Stat label="Owners" value={String(ownerCount)} />
                  <Stat label="Payments" value={String(paymentCount)} />
                </div>
              </div>

              {/* List */}
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {breakdown.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--color-surface-2)] text-[var(--color-muted)]">
                      <HandCoins className="h-5 w-5" />
                    </span>
                    <div className="text-sm font-medium">No payouts yet</div>
                    <div className="text-xs text-[var(--color-muted)]">
                      Once you settle a report, it shows up here.
                    </div>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {breakdown.map((o) => (
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
                              {o.payments.length} payment
                              {o.payments.length === 1 ? "" : "s"}
                            </div>
                          </div>
                          <div className="shrink-0 text-base font-bold tabular-nums text-emerald-700">
                            {formatCurrency(o.total, "AED", locale)}
                          </div>
                        </div>
                        <ul className="divide-y divide-[var(--color-border)]">
                          {o.payments.map((p) => (
                            <li
                              key={p.id}
                              className="flex items-start gap-3 px-3 py-2.5"
                            >
                              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-700">
                                {methodIcon(p.method)}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="text-sm font-semibold tabular-nums">
                                    {formatCurrency(p.amount, "AED", locale)}
                                  </div>
                                  <div className="inline-flex items-center gap-1 text-[10px] text-[var(--color-muted)]">
                                    <Calendar className="h-3 w-3" />
                                    {formatDate(p.date, locale)}
                                  </div>
                                </div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--color-muted)]">
                                  <span className="font-medium text-[var(--color-foreground)]">
                                    {methodLabel(p.method)}
                                  </span>
                                  {p.propertyName && (
                                    <>
                                      <span>·</span>
                                      <span
                                        className="inline-flex items-center gap-1"
                                      >
                                        {p.propertyColor && (
                                          <span
                                            className="h-2 w-2 rounded-full"
                                            style={{
                                              background: p.propertyColor,
                                            }}
                                          />
                                        )}
                                        {p.propertyName}
                                      </span>
                                    </>
                                  )}
                                  {p.reference && (
                                    <>
                                      <span>·</span>
                                      <span className="truncate">
                                        {p.reference}
                                      </span>
                                    </>
                                  )}
                                  {p.reportId && (
                                    <a
                                      href={`/${locale}/admin/reports/${p.reportId}`}
                                      className="ml-auto inline-flex items-center gap-0.5 text-[10px] font-medium text-[var(--color-brand)] hover:underline"
                                    >
                                      Report
                                      <ExternalLink className="h-2.5 w-2.5" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
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
  tone?: "emerald";
}) {
  return (
    <div
      className={
        tone === "emerald"
          ? "rounded-xl bg-emerald-500/10 p-2 text-center"
          : "rounded-xl bg-[var(--color-surface-2)] p-2 text-center"
      }
    >
      <div className="text-[9px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </div>
      <div
        className={
          tone === "emerald"
            ? "mt-0.5 text-sm font-bold tabular-nums text-emerald-700"
            : "mt-0.5 text-sm font-bold tabular-nums"
        }
      >
        {value}
      </div>
    </div>
  );
}
