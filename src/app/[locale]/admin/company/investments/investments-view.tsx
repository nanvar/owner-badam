"use client";

import {
  useActionState,
  useEffect,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Edit3,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Banknote,
  TrendingDown,
  TrendingUp,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Field, Textarea } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { PageHeader } from "@/components/app-shell";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  upsertInvestmentAction,
  deleteInvestmentAction,
  type InvestmentState,
} from "@/app/actions/investments";
import type { Locale } from "@/i18n/config";

type Kind = "INCOME" | "SPEND";

export type Entry = {
  id: string;
  kind: Kind;
  amount: number;
  source: string;
  description: string | null;
  date: string;
  propertyId: string | null;
  propertyName: string | null;
  propertyColor: string | null;
  expenseId: string | null;
};

export function InvestmentsView({
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
  tab: Kind;
  page: number;
  totalPages: number;
  counts: Record<Kind, number>;
  totals: { income: number; spent: number };
  entries: Entry[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Entry | null | undefined>(undefined);
  const [deletePending, startDelete] = useTransition();
  const [, startNav] = useTransition();

  const goTo = (next: Partial<{ tab: Kind; page: number }>) => {
    const params = new URLSearchParams();
    const t = next.tab ?? tab;
    if (t !== "INCOME") params.set("tab", t);
    const p = next.page ?? 1;
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    startNav(() => {
      router.push(`${basePath}${qs ? `?${qs}` : ""}`);
    });
  };

  const netInvested = totals.income - totals.spent;

  return (
    <div>
      <PageHeader title="Investments" />

      {/* 3-tile summary band — total income, total spent, net remaining */}
      <div className="mb-4 grid auto-rows-fr grid-cols-1 gap-3 *:h-full md:grid-cols-3">
        <SummaryTile
          tone="emerald"
          icon={<TrendingUp className="h-4 w-4" />}
          label="Total invested"
          value={formatCurrency(totals.income, "AED", locale)}
          sub={`${counts.INCOME} ${counts.INCOME === 1 ? "entry" : "entries"}`}
        />
        <SummaryTile
          tone="rose"
          icon={<TrendingDown className="h-4 w-4" />}
          label="Total spent"
          value={formatCurrency(totals.spent, "AED", locale)}
          sub={`${counts.SPEND} ${counts.SPEND === 1 ? "entry" : "entries"}`}
        />
        <SummaryTile
          tone={netInvested >= 0 ? "indigo" : "amber"}
          icon={<Banknote className="h-4 w-4" />}
          label="Net invested capital"
          value={formatCurrency(netInvested, "AED", locale)}
          sub={netInvested >= 0 ? "Available" : "Overdrawn"}
        />
      </div>

      {/* Tabs + Add */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-[var(--color-border)] bg-white p-1">
          {(["INCOME", "SPEND"] as const).map((k) => (
            <button
              key={k}
              onClick={() => goTo({ tab: k, page: 1 })}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                tab === k
                  ? k === "INCOME"
                    ? "bg-emerald-600 text-white"
                    : "bg-rose-600 text-white"
                  : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]",
              )}
            >
              {k === "INCOME" ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              {k === "INCOME" ? "Income" : "Spend"}
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
        <Button className="ml-auto" onClick={() => setEditing(null)}>
          <Plus className="h-4 w-4" />
          {tab === "INCOME" ? "Add income" : "Add spend"}
        </Button>
      </div>

      {entries.length === 0 ? (
        <Card className="grid place-items-center px-6 py-16 text-center">
          <Banknote className="h-8 w-8 text-[var(--color-muted)]" />
          <p className="mt-3 text-sm text-[var(--color-muted)]">
            {tab === "INCOME"
              ? "No investment income recorded yet."
              : "No investment spend recorded yet."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-visible">
          <div className="overflow-x-auto">
            <table className="grid-table w-full text-sm">
              <thead className="bg-[var(--color-surface-2)] text-xs uppercase tracking-wider text-[var(--color-muted)]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    {tab === "INCOME" ? "From" : "Spent on"}
                  </th>
                  {tab === "SPEND" && (
                    <th className="px-4 py-3 text-left font-semibold">
                      Property
                    </th>
                  )}
                  <th className="px-4 py-3 text-left font-semibold">
                    Description
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  <th className="w-24 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr
                    key={e.id}
                    className="hover:bg-[var(--color-surface-2)]/60"
                  >
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatDate(e.date, locale)}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {e.source}
                      {e.expenseId && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-indigo-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-indigo-700">
                          <Lock className="h-2.5 w-2.5" />
                          Auto
                        </span>
                      )}
                    </td>
                    {tab === "SPEND" && (
                      <td className="px-4 py-3">
                        {e.propertyName ? (
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="h-5 w-1 shrink-0 rounded-full"
                              style={{
                                background: e.propertyColor ?? "#94a3b8",
                              }}
                            />
                            <span className="font-medium">
                              {e.propertyName}
                            </span>
                          </span>
                        ) : (
                          <span className="text-[var(--color-muted)]">—</span>
                        )}
                      </td>
                    )}
                    <td className="max-w-[360px] truncate px-4 py-3">
                      {e.description || (
                        <span className="text-[var(--color-muted)]">—</span>
                      )}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right font-semibold tabular-nums",
                        e.kind === "INCOME"
                          ? "text-emerald-700"
                          : "text-rose-600",
                      )}
                    >
                      {e.kind === "INCOME" ? "+ " : "− "}
                      {formatCurrency(e.amount, "AED", locale)}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditing(e)}
                          disabled={!!e.expenseId}
                          aria-label="Edit"
                          title={
                            e.expenseId
                              ? "Edit the source expense instead"
                              : "Edit"
                          }
                          className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-foreground)] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (e.expenseId) {
                              alert(
                                "This row was auto-created from a property expense. Edit or delete that expense instead.",
                              );
                              return;
                            }
                            if (confirm("Delete this investment entry?")) {
                              startDelete(async () => {
                                await deleteInvestmentAction(e.id);
                                router.refresh();
                              });
                            }
                          }}
                          disabled={deletePending || !!e.expenseId}
                          aria-label="Delete"
                          title={
                            e.expenseId
                              ? "Delete the source expense instead"
                              : "Delete"
                          }
                          className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-rose-500/10 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
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

      <InvestmentEditor
        key={editing === undefined ? "inv-closed" : editing?.id ?? "inv-new"}
        open={editing !== undefined}
        kind={editing?.kind ?? tab}
        entry={editing ?? null}
        onClose={() => setEditing(undefined)}
      />
    </div>
  );
}

function SummaryTile({
  tone,
  icon,
  label,
  value,
  sub,
}: {
  tone: "emerald" | "rose" | "indigo" | "amber";
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  const toneMap: Record<typeof tone, string> = {
    emerald: "from-emerald-500/15 to-emerald-500/0 text-emerald-700",
    rose: "from-rose-500/15 to-rose-500/0 text-rose-600",
    indigo: "from-indigo-500/15 to-indigo-500/0 text-indigo-700",
    amber: "from-amber-500/15 to-amber-500/0 text-amber-700",
  };
  return (
    <Card className="h-full overflow-hidden">
      <div
        className={cn(
          "flex h-full flex-col gap-2 bg-gradient-to-br p-4",
          toneMap[tone],
        )}
      >
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
            {label}
          </div>
          <div className="opacity-80">{icon}</div>
        </div>
        <div className="text-2xl font-bold tabular-nums text-[var(--color-foreground)]">
          {value}
        </div>
        <div className="text-[10px] uppercase tracking-wider opacity-70">
          {sub}
        </div>
      </div>
    </Card>
  );
}

function InvestmentEditor({
  open,
  kind,
  entry,
  onClose,
}: {
  open: boolean;
  kind: Kind;
  entry: Entry | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<
    InvestmentState | undefined,
    FormData
  >(upsertInvestmentAction, undefined);

  useEffect(() => {
    if (state?.status === "ok" && open) {
      router.refresh();
      onClose();
    }
  }, [state, open, onClose, router]);

  const isSpend = kind === "SPEND";

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        entry
          ? `Edit ${isSpend ? "spend" : "income"}`
          : `Add ${isSpend ? "spend" : "income"}`
      }
    >
      <form action={action} className="space-y-4">
        {entry && <input type="hidden" name="id" value={entry.id} />}
        <input type="hidden" name="kind" value={kind} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" htmlFor="inv-date">
            <Input
              id="inv-date"
              name="date"
              type="date"
              required
              defaultValue={
                entry?.date
                  ? entry.date.slice(0, 10)
                  : new Date().toISOString().slice(0, 10)
              }
            />
          </Field>
          <Field label="Amount (AED)" htmlFor="inv-amount">
            <Input
              id="inv-amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              defaultValue={entry?.amount || ""}
            />
          </Field>
        </div>
        <Field
          label={isSpend ? "Spent on" : "Source"}
          htmlFor="inv-source"
          hint={
            isSpend
              ? "What this payment was for"
              : "Who or where the money came from"
          }
        >
          <Input
            id="inv-source"
            name="source"
            type="text"
            required
            maxLength={255}
            defaultValue={entry?.source ?? ""}
            placeholder={
              isSpend
                ? "Office equipment / Cash withdrawal / etc."
                : "Founder injection / Partner X / Bank loan"
            }
          />
        </Field>
        <Field label="Description" htmlFor="inv-description" hint="Optional">
          <Textarea
            id="inv-description"
            name="description"
            defaultValue={entry?.description ?? ""}
            placeholder="Additional context (purpose, terms, etc.)"
          />
        </Field>
        {state?.status === "error" && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600">
            {state.message}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={pending}>
            Save
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
