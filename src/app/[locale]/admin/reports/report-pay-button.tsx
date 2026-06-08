"use client";

// Per-row "Pay" trigger for the admin Reports list. Opens a redesigned
// modal that captures (date, method, optional reference, optional notes)
// and calls payReportAction. Method offers nine presets + a Custom slot
// so any rare channel (Western Union, crypto, in-kind, …) can still be
// recorded without a code change.

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Wallet,
  X,
  Loader2,
  Banknote,
  CreditCard,
  ArrowRightLeft,
  CheckCircle2,
  ScrollText,
  Send,
  Smartphone,
  Bitcoin,
  Globe2,
  MoreHorizontal,
  Calendar,
  Building2,
  User,
  StickyNote,
  Hash,
} from "lucide-react";
import { payReportAction } from "@/app/actions/owner-reports";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Locale } from "@/i18n/config";

type Method = {
  value: string;
  label: string;
  icon: React.ReactNode;
  hint?: string;
};

const PRESETS: Method[] = [
  { value: "cash", label: "Cash", icon: <Banknote className="h-4 w-4" />, hint: "Hand delivered" },
  { value: "bank_transfer", label: "Bank transfer", icon: <ArrowRightLeft className="h-4 w-4" />, hint: "Local IBAN" },
  { value: "wire", label: "Wire", icon: <Send className="h-4 w-4" />, hint: "International" },
  { value: "card", label: "Card", icon: <CreditCard className="h-4 w-4" />, hint: "Debit / credit" },
  { value: "cheque", label: "Cheque", icon: <ScrollText className="h-4 w-4" />, hint: "Paper / certified" },
  { value: "paypal", label: "PayPal", icon: <Smartphone className="h-4 w-4" />, hint: "Online wallet" },
  { value: "stripe", label: "Stripe", icon: <CreditCard className="h-4 w-4" />, hint: "Card processor" },
  { value: "western_union", label: "Western Union", icon: <Globe2 className="h-4 w-4" />, hint: "Cash pickup" },
  { value: "crypto", label: "Crypto", icon: <Bitcoin className="h-4 w-4" />, hint: "USDT / BTC / ETH" },
];

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Title-case a slug for display in the date row (e.g. "western_union"
// → "Western Union"). PRESETS already provide a clean label; this only
// kicks in for custom values typed by the admin.
function prettifyMethod(slug: string): string {
  return slug
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
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
  const [method, setMethod] = useState<string>("bank_transfer");
  const [customMethod, setCustomMethod] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);

  const reset = () => {
    setError(null);
    setDone(false);
    setReference("");
    setNotes("");
    setDate(todayIso());
    setMethod("bank_transfer");
    setCustomMethod("");
    setShowCustom(false);
  };

  const effectiveMethod = useMemo(() => {
    if (showCustom) {
      return customMethod
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_")
        .slice(0, 32);
    }
    return method;
  }, [showCustom, customMethod, method]);

  const submit = () => {
    setError(null);
    if (!effectiveMethod) {
      setError("Please pick or type a payment method.");
      return;
    }
    start(async () => {
      const fd = new FormData();
      fd.set("reportId", reportId);
      fd.set("date", date);
      fd.set("method", effectiveMethod);
      if (reference.trim()) fd.set("reference", reference.trim());
      if (notes.trim()) fd.set("notes", notes.trim());
      const res = await payReportAction(undefined, fd);
      if (res.status === "ok") {
        setDone(true);
        router.refresh();
        setTimeout(() => {
          setOpen(false);
          reset();
        }, 700);
      } else if (res.status === "error") {
        setError(res.message);
      }
    });
  };

  const dateLabelIso = useMemo(() => {
    try {
      const d = new Date(`${date}T00:00:00`);
      return formatDate(d.toISOString(), locale);
    } catch {
      return date;
    }
  }, [date, locale]);

  const close = () => {
    if (pending) return;
    setOpen(false);
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
          <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm"
              onClick={close}
            />
            <motion.div
              initial={{ opacity: 0, y: 32, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 32, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 360, damping: 34 }}
              className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:max-h-[88vh] sm:rounded-3xl"
            >
              {/* ===== Hero ===== */}
              <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 px-5 pb-5 pt-5 text-white">
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close"
                  disabled={pending}
                  className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-xl bg-white/15 text-white/90 backdrop-blur transition-colors hover:bg-white/25 disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80">
                  Record settlement
                </div>
                <div className="mt-2 text-3xl font-bold tabular-nums sm:text-4xl">
                  {formatCurrency(amount, "AED", locale)}
                </div>
                <div className="mt-1 text-xs text-white/85">
                  {reportName}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 backdrop-blur">
                    <User className="h-3 w-3" />
                    {ownerName}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 backdrop-blur">
                    <Building2 className="h-3 w-3" />
                    {propertyName}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 backdrop-blur">
                    <Calendar className="h-3 w-3" />
                    {dateLabelIso}
                  </span>
                </div>
              </div>

              {/* ===== Form body ===== */}
              <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--color-surface)] px-5 py-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Field
                    label="Payment date"
                    icon={<Calendar className="h-3.5 w-3.5" />}
                  >
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      disabled={pending}
                      className="block w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm focus:border-[var(--color-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 disabled:opacity-50"
                    />
                  </Field>

                  <Field
                    label="Reference (optional)"
                    icon={<Hash className="h-3.5 w-3.5" />}
                  >
                    <input
                      type="text"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      disabled={pending}
                      placeholder="Transfer ID, receipt #…"
                      maxLength={120}
                      className="block w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm focus:border-[var(--color-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 disabled:opacity-50"
                    />
                  </Field>
                </div>

                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between">
                    <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                      <Wallet className="h-3.5 w-3.5" />
                      Method
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCustom((v) => !v);
                        if (!showCustom) setMethod("");
                        else setMethod("bank_transfer");
                      }}
                      disabled={pending}
                      className={
                        showCustom
                          ? "inline-flex items-center gap-1 rounded-lg bg-[var(--color-brand)] px-2 py-1 text-[10px] font-semibold text-white"
                          : "inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-2 py-1 text-[10px] font-semibold text-[var(--color-muted)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
                      }
                    >
                      <MoreHorizontal className="h-3 w-3" />
                      {showCustom ? "Pick preset" : "Custom"}
                    </button>
                  </div>
                  {showCustom ? (
                    <div className="rounded-2xl border-2 border-dashed border-[var(--color-brand)]/40 bg-white p-3">
                      <input
                        type="text"
                        autoFocus
                        value={customMethod}
                        onChange={(e) => setCustomMethod(e.target.value)}
                        disabled={pending}
                        placeholder="e.g. tabby, in-kind, voucher…"
                        maxLength={32}
                        className="block w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus:border-[var(--color-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 disabled:opacity-50"
                      />
                      <div className="mt-1.5 text-[10px] text-[var(--color-muted)]">
                        Saved as{" "}
                        <code className="rounded bg-[var(--color-surface-2)] px-1 py-0.5 font-mono text-[10px]">
                          {effectiveMethod || "—"}
                        </code>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {PRESETS.map((m) => {
                        const active = method === m.value;
                        return (
                          <button
                            key={m.value}
                            type="button"
                            onClick={() => setMethod(m.value)}
                            disabled={pending}
                            className={
                              active
                                ? "flex items-center gap-2 rounded-xl border-2 border-[var(--color-brand)] bg-[var(--color-brand-soft)] p-3 text-left shadow-sm transition-all"
                                : "flex items-center gap-2 rounded-xl border-2 border-transparent bg-white p-3 text-left transition-all hover:border-[var(--color-border)] hover:bg-[var(--color-surface-2)]/50"
                            }
                          >
                            <span
                              className={
                                active
                                  ? "grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--color-brand)] text-white"
                                  : "grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--color-surface-2)] text-[var(--color-muted)]"
                              }
                            >
                              {m.icon}
                            </span>
                            <span className="min-w-0">
                              <span
                                className={
                                  active
                                    ? "block truncate text-xs font-bold text-[var(--color-brand)]"
                                    : "block truncate text-xs font-bold text-[var(--color-foreground)]"
                                }
                              >
                                {m.label}
                              </span>
                              <span className="block truncate text-[10px] text-[var(--color-muted)]">
                                {m.hint}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <Field
                  className="mt-5"
                  label="Notes (optional)"
                  icon={<StickyNote className="h-3.5 w-3.5" />}
                >
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={pending}
                    placeholder="Internal note for this settlement…"
                    rows={2}
                    maxLength={500}
                    className="block w-full resize-none rounded-xl border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm focus:border-[var(--color-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 disabled:opacity-50"
                  />
                </Field>

                {error && (
                  <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs font-medium text-rose-700">
                    {error}
                  </div>
                )}
              </div>

              {/* ===== Footer ===== */}
              <div className="shrink-0 border-t border-[var(--color-border)] bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] text-[var(--color-muted)]">
                    {showCustom
                      ? "Custom method"
                      : `Method: ${prettifyMethod(method || "—")}`}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={close}
                      disabled={pending}
                      className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={submit}
                      disabled={pending || done}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-brand)] px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--color-brand)]/90 disabled:opacity-60"
                    >
                      {pending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : done ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Wallet className="h-4 w-4" />
                      )}
                      {done
                        ? "Recorded"
                        : pending
                          ? "Recording…"
                          : `Record ${formatCurrency(amount, "AED", locale)}`}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

function Field({
  label,
  icon,
  className,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        {icon}
        {label}
      </label>
      {children}
    </div>
  );
}
