"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  HandCoins,
  RotateCcw,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app-shell";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  markOwnerDebtPaidAction,
  markOwnerDebtPendingAction,
} from "@/app/actions/owner-debts";
import {
  EXPENSE_TYPE_LABELS,
  EXPENSE_TYPE_TONE,
  type ExpenseTypeKey,
} from "@/lib/expense-types";
import type { Locale } from "@/i18n/config";

type DebtStatus = "PENDING" | "PAID";

export type Entry = {
  id: string;
  ownerId: string;
  ownerName: string;
  propertyId: string | null;
  propertyName: string | null;
  propertyColor: string | null;
  expenseId: string | null;
  expenseType: ExpenseTypeKey | null;
  expenseDate: string | null;
  amount: number;
  description: string | null;
  status: DebtStatus;
  paidAt: string | null;
  createdAt: string;
};

export function OwnerDebtsView({
  locale,
  basePath,
  tab,
  page,
  totalPages,
  counts,
  totals,
  entries,
}: {
  locale: Locale;
  basePath: string;
  tab: DebtStatus;
  page: number;
  totalPages: number;
  counts: Record<DebtStatus, number>;
  totals: { pending: number; paid: number };
  entries: Entry[];
}) {
  const router = useRouter();
  const [pending, startTx] = useTransition();
  const [, startNav] = useTransition();

  const goTo = (next: Partial<{ tab: DebtStatus; page: number }>) => {
    const params = new URLSearchParams();
    const t = next.tab ?? tab;
    if (t !== "PENDING") params.set("tab", t);
    const p = next.page ?? 1;
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    startNav(() => {
      router.push(`${basePath}${qs ? `?${qs}` : ""}`);
    });
  };

  return (
    <div>
      <PageHeader title="Owner debts" />

      {/* Summary band */}
      <div className="mb-4 grid auto-rows-fr grid-cols-1 gap-3 *:h-full md:grid-cols-2">
        <div className="flex items-center justify-between rounded-2xl border border-amber-500/30 bg-amber-500/5 px-5 py-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
              Outstanding
            </div>
            <div className="mt-0.5 text-xs text-amber-700/70">
              {counts.PENDING} {counts.PENDING === 1 ? "debt" : "debts"} pending
            </div>
          </div>
          <div className="text-2xl font-bold tabular-nums text-amber-700">
            {formatCurrency(totals.pending, "AED", locale)}
          </div>
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-5 py-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              Settled lifetime
            </div>
            <div className="mt-0.5 text-xs text-emerald-700/70">
              {counts.PAID} {counts.PAID === 1 ? "debt" : "debts"} paid
            </div>
          </div>
          <div className="text-2xl font-bold tabular-nums text-emerald-700">
            {formatCurrency(totals.paid, "AED", locale)}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-[var(--color-border)] bg-white p-1">
          {(["PENDING", "PAID"] as const).map((k) => (
            <button
              key={k}
              onClick={() => goTo({ tab: k, page: 1 })}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                tab === k
                  ? k === "PENDING"
                    ? "bg-amber-500 text-white"
                    : "bg-emerald-600 text-white"
                  : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]",
              )}
            >
              {k === "PENDING" ? (
                <Clock className="h-3.5 w-3.5" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {k === "PENDING" ? "Pending" : "Paid"}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px] font-bold",
                  tab === k
                    ? "bg-white/25 text-white"
                    : "bg-[var(--color-surface-2)] text-[var(--color-muted)]",
                )}
              >
                {counts[k]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {entries.length === 0 ? (
        <Card className="grid place-items-center px-6 py-16 text-center">
          <HandCoins className="h-8 w-8 text-[var(--color-muted)]" />
          <p className="mt-3 text-sm text-[var(--color-muted)]">
            {tab === "PENDING"
              ? "No outstanding owner debts."
              : "No settled debts yet."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-visible">
          <div className="overflow-x-auto">
            <table className="grid-table w-full text-sm">
              <thead className="bg-[var(--color-surface-2)] text-xs uppercase tracking-wider text-[var(--color-muted)]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Owner</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Property
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Reason</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    {tab === "PENDING" ? "Recorded" : "Paid"}
                  </th>
                  <th className="w-28 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr
                    key={e.id}
                    className="hover:bg-[var(--color-surface-2)]/60"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-medium">
                      {e.ownerName}
                    </td>
                    <td className="px-4 py-3">
                      {e.propertyName ? (
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="h-5 w-1 shrink-0 rounded-full"
                            style={{
                              background: e.propertyColor ?? "#94a3b8",
                            }}
                          />
                          <span className="font-medium">{e.propertyName}</span>
                        </span>
                      ) : (
                        <span className="text-[var(--color-muted)]">—</span>
                      )}
                    </td>
                    <td className="max-w-[360px] truncate px-4 py-3">
                      {e.expenseType && (
                        <span
                          className={cn(
                            "mr-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                            EXPENSE_TYPE_TONE[e.expenseType],
                          )}
                        >
                          {EXPENSE_TYPE_LABELS[e.expenseType]}
                        </span>
                      )}
                      <span className="text-[var(--color-foreground)]">
                        {e.description ||
                          (e.expenseType
                            ? "—"
                            : "Manual debt")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-rose-600">
                      {formatCurrency(e.amount, "AED", locale)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--color-muted)]">
                      {tab === "PAID" && e.paidAt
                        ? formatDate(e.paidAt, locale)
                        : formatDate(e.createdAt, locale)}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {tab === "PENDING" ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={pending}
                            onClick={() => {
                              startTx(async () => {
                                await markOwnerDebtPaidAction(e.id);
                                router.refresh();
                              });
                            }}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Mark paid
                          </Button>
                        ) : (
                          <button
                            disabled={pending}
                            onClick={() => {
                              if (!confirm("Move this debt back to pending?"))
                                return;
                              startTx(async () => {
                                await markOwnerDebtPendingAction(e.id);
                                router.refresh();
                              });
                            }}
                            aria-label="Mark pending"
                            title="Undo — mark as pending"
                            className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-foreground)] disabled:opacity-50"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm">
          <button
            disabled={page <= 1}
            onClick={() => goTo({ page: page - 1 })}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--color-border)] bg-white px-3 text-xs font-medium hover:bg-[var(--color-surface-2)] disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Prev
          </button>
          <span className="text-xs text-[var(--color-muted)]">
            Page {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => goTo({ page: page + 1 })}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--color-border)] bg-white px-3 text-xs font-medium hover:bg-[var(--color-surface-2)] disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
