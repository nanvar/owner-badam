"use client";

// Per-row "Pay" trigger for the admin Reports list. Opens a modal that
// captures (date, method, optional reference) and calls payReportAction.
// On success Next-router refreshes so the row moves to the Paid tab.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Wallet, X, Loader2, Banknote, CreditCard, ArrowRightLeft, CheckCircle2 } from "lucide-react";
import { payReportAction } from "@/app/actions/owner-reports";
import { formatCurrency } from "@/lib/utils";
import type { Locale } from "@/i18n/config";

type Method = "cash" | "bank_transfer" | "card";

const METHODS: { value: Method; label: string; icon: React.ReactNode }[] = [
  { value: "cash", label: "Cash", icon: <Banknote className="h-4 w-4" /> },
  {
    value: "bank_transfer",
    label: "Bank transfer",
    icon: <ArrowRightLeft className="h-4 w-4" />,
  },
  { value: "card", label: "Card", icon: <CreditCard className="h-4 w-4" /> },
];

function todayIso(): string {
  const d = new Date();
  // YYYY-MM-DD in local time — `<input type="date">` expects this exact
  // format and the browser handles the timezone consistently.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ReportPayButton({
  reportId,
  reportName,
  amount,
  locale,
  ownerName,
  propertyName,
}: {
  reportId: string;
  reportName: string;
  amount: number;
  locale: Locale;
  ownerName: string;
  propertyName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [method, setMethod] = useState<Method>("bank_transfer");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);

  const reset = () => {
    setError(null);
    setDone(false);
    setReference("");
    setDate(todayIso());
    setMethod("bank_transfer");
  };

  const submit = () => {
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set("reportId", reportId);
      fd.set("date", date);
      fd.set("method", method);
      if (reference.trim()) fd.set("reference", reference.trim());
      const res = await payReportAction(undefined, fd);
      if (res.status === "ok") {
        setDone(true);
        router.refresh();
        // Small delay so the success state is visible before the dialog
        // closes — feels less abrupt than dropping out instantly.
        setTimeout(() => {
          setOpen(false);
          reset();
        }, 700);
      } else if (res.status === "error") {
        setError(res.message);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-brand)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[var(--color-brand)]/90"
      >
        <Wallet className="h-3.5 w-3.5" />
        Pay
      </button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
              onClick={() => !pending && setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              className="relative w-full max-w-md overflow-hidden rounded-t-[24px] bg-white shadow-2xl sm:rounded-2xl"
            >
              <div className="border-b border-[var(--color-border)] p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                      Record settlement
                    </div>
                    <div className="mt-1 truncate text-base font-bold">
                      {reportName}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-[var(--color-muted)]">
                      {ownerName} · {propertyName}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => !pending && setOpen(false)}
                    aria-label="Close"
                    disabled={pending}
                    className="grid h-8 w-8 place-items-center rounded-lg text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 rounded-xl bg-emerald-500/10 p-3 text-center">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                    Amount
                  </div>
                  <div className="mt-0.5 text-2xl font-bold tabular-nums text-emerald-700">
                    {formatCurrency(amount, "AED", locale)}
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-4">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Payment date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    disabled={pending}
                    className="mt-1 block w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus:border-[var(--color-brand)] focus:outline-none disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Method
                  </label>
                  <div className="mt-1 grid grid-cols-3 gap-2">
                    {METHODS.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setMethod(m.value)}
                        disabled={pending}
                        className={
                          method === m.value
                            ? "flex flex-col items-center gap-1.5 rounded-xl border-2 border-[var(--color-brand)] bg-[var(--color-brand-soft)] p-3 text-xs font-semibold text-[var(--color-brand)]"
                            : "flex flex-col items-center gap-1.5 rounded-xl border-2 border-transparent bg-[var(--color-surface-2)] p-3 text-xs font-medium text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-2)]/70"
                        }
                      >
                        {m.icon}
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Reference (optional)
                  </label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    disabled={pending}
                    placeholder="Transfer id, receipt #, …"
                    maxLength={120}
                    className="mt-1 block w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus:border-[var(--color-brand)] focus:outline-none disabled:opacity-50"
                  />
                </div>

                {error && (
                  <div className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-700">
                    {error}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-3">
                <button
                  type="button"
                  onClick={() => !pending && setOpen(false)}
                  disabled={pending}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--color-muted)] hover:bg-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={pending || done}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--color-brand)]/90 disabled:opacity-60"
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : done ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Wallet className="h-4 w-4" />
                  )}
                  {done ? "Recorded" : pending ? "Recording…" : "Record payment"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
