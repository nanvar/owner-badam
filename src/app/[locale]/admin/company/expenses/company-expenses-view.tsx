"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Edit3,
  Trash2,
  Receipt,
  TrendingUp,
  Wallet,
  Calendar,
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Field, Textarea } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { PageHeader } from "@/components/app-shell";
import {
  formatCurrency,
  formatDate,
  cn,
  monthOptions,
  monthLabel,
} from "@/lib/utils";
import {
  upsertCompanyExpenseAction,
  deleteCompanyExpenseAction,
  refundDepositAction,
  unrefundDepositAction,
  type CompanyExpenseState,
} from "@/app/actions/company-expenses";
import {
  COMPANY_EXPENSE_CATEGORIES,
  COMPANY_EXPENSE_CATEGORY_LABELS,
  COMPANY_EXPENSE_CATEGORY_TONE,
  type CompanyExpenseCategoryKey,
} from "@/lib/company-expense-types";
import type { Locale } from "@/i18n/config";

export type Kind = "EXPENSE" | "PROFIT" | "DEPOSIT";

export type Entry = {
  id: string;
  kind: Kind;
  date: string;
  category: CompanyExpenseCategoryKey | null;
  propertyId: string | null;
  propertyName: string | null;
  propertyColor: string | null;
  description: string;
  amount: number;
  refundedAt: string | null;
  refundedAmount: number | null;
};

type PropertyOption = { id: string; name: string; color: string };

export function CompanyFinancesView({
  locale,
  tab,
  from,
  to,
  page,
  totalPages,
  counts,
  activeDepositsTotal,
  activeDepositsCount,
  entries,
  properties,
}: {
  locale: Locale;
  tab: Kind;
  from: string;
  to: string;
  page: number;
  totalPages: number;
  counts: Record<Kind, number>;
  activeDepositsTotal: number;
  activeDepositsCount: number;
  entries: Entry[];
  properties: PropertyOption[];
}) {
  const router = useRouter();
  const [editingExpense, setEditingExpense] = useState<Entry | null | undefined>(
    undefined,
  );
  const [editingProfit, setEditingProfit] = useState<Entry | null | undefined>(
    undefined,
  );
  const [editingDeposit, setEditingDeposit] = useState<Entry | null | undefined>(
    undefined,
  );
  const [refunding, setRefunding] = useState<Entry | null>(null);
  const [deletePending, startDelete] = useTransition();
  const [unrefundPending, startUnrefund] = useTransition();
  const [, startNav] = useTransition();

  const goTo = (next: Partial<{ tab: Kind; from: string; to: string; page: number }>) => {
    const params = new URLSearchParams();
    const t = next.tab ?? tab;
    if (t !== "EXPENSE") params.set("tab", t);
    const f = next.from ?? from;
    const e = next.to ?? to;
    if (f) params.set("from", f);
    if (e) params.set("to", e);
    const p = next.page ?? 1;
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    startNav(() => {
      router.push(`/${locale}/admin/company/expenses${qs ? `?${qs}` : ""}`);
    });
  };

  const handleAdd = () => {
    if (tab === "EXPENSE") setEditingExpense(null);
    else if (tab === "PROFIT") setEditingProfit(null);
    else setEditingDeposit(null);
  };

  return (
    <div>
      <PageHeader title="Company finances" />

      {/* Active deposits summary so admins can see at a glance how much is
          still being held on behalf of guests. */}
      {activeDepositsCount > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-sky-500/30 bg-sky-500/5 px-5 py-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
              Active deposits held
            </div>
            <div className="mt-0.5 text-xs text-sky-700/70">
              {activeDepositsCount} active
            </div>
          </div>
          <div className="text-2xl font-bold tabular-nums text-sky-700">
            {formatCurrency(activeDepositsTotal, "AED", locale)}
          </div>
        </div>
      )}

      {/* Tabs + add */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-[var(--color-border)] bg-white p-1">
          {(["EXPENSE", "PROFIT", "DEPOSIT"] as const).map((k) => (
            <button
              key={k}
              onClick={() => goTo({ tab: k, page: 1 })}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                tab === k
                  ? k === "EXPENSE"
                    ? "bg-rose-500 text-white"
                    : k === "PROFIT"
                      ? "bg-emerald-600 text-white"
                      : "bg-sky-600 text-white"
                  : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]",
              )}
            >
              {k === "EXPENSE" ? (
                <Receipt className="h-3.5 w-3.5" />
              ) : k === "PROFIT" ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <Wallet className="h-3.5 w-3.5" />
              )}
              {k === "EXPENSE" ? "Expenses" : k === "PROFIT" ? "Profit" : "Deposit"}
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
        <Button className="ml-auto" onClick={handleAdd}>
          <Plus className="h-4 w-4" />
          {tab === "EXPENSE"
            ? "Add expense"
            : tab === "PROFIT"
              ? "Add profit"
              : "Add deposit"}
        </Button>
      </div>

      {/* Date filter */}
      <DateFilter
        from={from}
        to={to}
        onApply={(f, t) => goTo({ from: f, to: t, page: 1 })}
      />

      {entries.length === 0 ? (
        <Card className="grid place-items-center px-6 py-16 text-center">
          <p className="text-sm text-[var(--color-muted)]">
            No entries in this period.
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
                    {tab === "EXPENSE" ? "Category" : "Property"}
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Description
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  {tab === "DEPOSIT" && (
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                  )}
                  <th className="w-32 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr
                    key={e.id}
                    className="hover:bg-[var(--color-surface-2)]/60"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDate(e.date, locale)}
                    </td>
                    <td className="px-4 py-3">
                      {e.kind === "EXPENSE" && e.category ? (
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                            COMPANY_EXPENSE_CATEGORY_TONE[e.category],
                          )}
                        >
                          {COMPANY_EXPENSE_CATEGORY_LABELS[e.category]}
                        </span>
                      ) : e.propertyName ? (
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
                        "—"
                      )}
                    </td>
                    <td className="max-w-[360px] truncate px-4 py-3">
                      {e.description || (
                        <span className="text-[var(--color-muted)]">—</span>
                      )}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right font-semibold tabular-nums",
                        e.kind === "EXPENSE"
                          ? "text-rose-600"
                          : e.kind === "PROFIT"
                            ? "text-emerald-700"
                            : "text-sky-700",
                      )}
                    >
                      {e.kind === "EXPENSE"
                        ? "− "
                        : e.kind === "PROFIT"
                          ? "+ "
                          : ""}
                      {formatCurrency(e.amount, "AED", locale)}
                    </td>
                    {tab === "DEPOSIT" && (
                      <td className="px-4 py-3">
                        {e.refundedAt ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" />
                            Refunded
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-700">
                            Held
                          </span>
                        )}
                      </td>
                    )}
                    <td className="px-2 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {tab === "DEPOSIT" && !e.refundedAt && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setRefunding(e)}
                          >
                            Payout
                          </Button>
                        )}
                        {tab === "DEPOSIT" && e.refundedAt && (
                          <button
                            disabled={unrefundPending}
                            onClick={() => {
                              if (
                                !confirm("Undo refund? Mark deposit as held again.")
                              )
                                return;
                              startUnrefund(async () => {
                                await unrefundDepositAction(e.id);
                                router.refresh();
                              });
                            }}
                            aria-label="Undo refund"
                            title="Undo refund"
                            className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-foreground)] disabled:opacity-50"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (e.kind === "EXPENSE") setEditingExpense(e);
                            else if (e.kind === "PROFIT") setEditingProfit(e);
                            else setEditingDeposit(e);
                          }}
                          aria-label="Edit"
                          className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-foreground)]"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm("Delete this entry?")) {
                              startDelete(async () => {
                                await deleteCompanyExpenseAction(e.id);
                                router.refresh();
                              });
                            }
                          }}
                          disabled={deletePending}
                          aria-label="Delete"
                          className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-50"
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm">
          <button
            disabled={page <= 1}
            onClick={() => goTo({ page: page - 1 })}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--color-border)] bg-white px-3 text-xs font-medium disabled:opacity-40 hover:bg-[var(--color-surface-2)]"
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
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--color-border)] bg-white px-3 text-xs font-medium disabled:opacity-40 hover:bg-[var(--color-surface-2)]"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <ExpenseEditor
        key={
          editingExpense === undefined
            ? "exp-closed"
            : editingExpense?.id ?? "exp-new"
        }
        open={editingExpense !== undefined}
        entry={editingExpense ?? null}
        onClose={() => setEditingExpense(undefined)}
      />
      <ProfitEditor
        key={
          editingProfit === undefined
            ? "pro-closed"
            : editingProfit?.id ?? "pro-new"
        }
        open={editingProfit !== undefined}
        entry={editingProfit ?? null}
        properties={properties}
        onClose={() => setEditingProfit(undefined)}
      />
      <DepositEditor
        key={
          editingDeposit === undefined
            ? "dep-closed"
            : editingDeposit?.id ?? "dep-new"
        }
        open={editingDeposit !== undefined}
        entry={editingDeposit ?? null}
        properties={properties}
        onClose={() => setEditingDeposit(undefined)}
      />
      <RefundModal
        key={refunding?.id ?? "refund-closed"}
        deposit={refunding}
        locale={locale}
        onClose={() => setRefunding(null)}
      />
    </div>
  );
}

function DateFilter({
  from,
  to,
  onApply,
}: {
  from: string;
  to: string;
  onApply: (from: string, to: string) => void;
}) {
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  const hasActive = !!(from || to);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onApply(f, t);
      }}
      className="mb-4 rounded-2xl border-2 border-[var(--color-border)] bg-white p-4 shadow-sm"
    >
      <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
        <Calendar className="h-3.5 w-3.5" />
        Date filter
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block flex-1 min-w-[180px]">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            From
          </span>
          <span className="flex h-10 items-center rounded-xl border-2 border-[var(--color-border)] bg-white px-3 transition-colors focus-within:border-[var(--color-brand)] focus-within:ring-[3px] focus-within:ring-[var(--color-brand)]/20 hover:border-[var(--color-border-strong,#cbd5d3)]">
            <input
              type="date"
              value={f}
              onChange={(e) => setF(e.target.value)}
              aria-label="From"
              className="h-full w-full bg-transparent text-sm font-medium focus:outline-none"
            />
          </span>
        </label>
        <label className="block flex-1 min-w-[180px]">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            To
          </span>
          <span className="flex h-10 items-center rounded-xl border-2 border-[var(--color-border)] bg-white px-3 transition-colors focus-within:border-[var(--color-brand)] focus-within:ring-[3px] focus-within:ring-[var(--color-brand)]/20 hover:border-[var(--color-border-strong,#cbd5d3)]">
            <input
              type="date"
              value={t}
              onChange={(e) => setT(e.target.value)}
              aria-label="To"
              className="h-full w-full bg-transparent text-sm font-medium focus:outline-none"
            />
          </span>
        </label>
        <div className="flex items-end gap-2">
          <Button type="submit">Apply</Button>
          {hasActive && (
            <button
              type="button"
              onClick={() => {
                setF("");
                setT("");
                onApply("", "");
              }}
              className="inline-flex h-10 items-center gap-1 rounded-xl border-2 border-[var(--color-border)] bg-white px-3 text-sm font-medium text-[var(--color-muted)] transition-colors hover:border-[var(--color-brand)] hover:text-[var(--color-foreground)]"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

function ExpenseEditor({
  open,
  entry,
  onClose,
}: {
  open: boolean;
  entry: Entry | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<
    CompanyExpenseState | undefined,
    FormData
  >(upsertCompanyExpenseAction, undefined);
  const [category, setCategory] = useState<string>(entry?.category ?? "OTHER");

  useEffect(() => {
    if (state?.status === "ok" && open) {
      router.refresh();
      onClose();
    }
  }, [state, open, onClose, router]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={entry ? "Edit expense" : "Add company expense"}
    >
      <form action={action} className="space-y-4">
        {entry && <input type="hidden" name="id" value={entry.id} />}
        <input type="hidden" name="kind" value="EXPENSE" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" htmlFor="exp-date">
            <Input
              id="exp-date"
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
          <Field label="Amount (AED)" htmlFor="exp-amount">
            <Input
              id="exp-amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              defaultValue={entry?.amount || ""}
            />
          </Field>
        </div>
        <Field label="Category" htmlFor="exp-category">
          <select
            id="exp-category"
            name="category"
            required
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-11 w-full rounded-xl border-2 border-[var(--color-border)] bg-white px-3 text-sm font-medium transition-colors hover:border-[#cbd5d3] focus:border-[var(--color-brand)] focus:outline-none focus:ring-[3px] focus:ring-[var(--color-brand)]/25"
          >
            {COMPANY_EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {COMPANY_EXPENSE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Description"
          htmlFor="exp-description"
          hint={
            category === "OTHER"
              ? "Required — describe the expense"
              : "Optional"
          }
        >
          <Textarea
            id="exp-description"
            name="description"
            required={category === "OTHER"}
            defaultValue={entry?.description ?? ""}
            placeholder="Office rent, March 2026"
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

function ProfitEditor({
  open,
  entry,
  properties,
  onClose,
}: {
  open: boolean;
  entry: Entry | null;
  properties: PropertyOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<
    CompanyExpenseState | undefined,
    FormData
  >(upsertCompanyExpenseAction, undefined);

  useEffect(() => {
    if (state?.status === "ok" && open) {
      router.refresh();
      onClose();
    }
  }, [state, open, onClose, router]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={entry ? "Edit profit" : "Add company profit"}
    >
      <form action={action} className="space-y-4">
        {entry && <input type="hidden" name="id" value={entry.id} />}
        <input type="hidden" name="kind" value="PROFIT" />
        <Field label="Property" htmlFor="pro-property">
          <select
            id="pro-property"
            name="propertyId"
            required
            defaultValue={entry?.propertyId ?? ""}
            className="h-11 w-full rounded-xl border-2 border-[var(--color-border)] bg-white px-3 text-sm font-medium transition-colors hover:border-[#cbd5d3] focus:border-[var(--color-brand)] focus:outline-none focus:ring-[3px] focus:ring-[var(--color-brand)]/25"
          >
            <option value="" disabled>
              Select a property…
            </option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" htmlFor="pro-date">
            <Input
              id="pro-date"
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
          <Field label="Amount (AED)" htmlFor="pro-amount">
            <Input
              id="pro-amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              defaultValue={entry?.amount || ""}
            />
          </Field>
        </div>
        <Field label="Description" htmlFor="pro-description">
          <Textarea
            id="pro-description"
            name="description"
            required
            defaultValue={entry?.description ?? ""}
            placeholder="Late check-out fee, parking, etc."
          />
        </Field>
        <MonthPicker />
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

function DepositEditor({
  open,
  entry,
  properties,
  onClose,
}: {
  open: boolean;
  entry: Entry | null;
  properties: PropertyOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<
    CompanyExpenseState | undefined,
    FormData
  >(upsertCompanyExpenseAction, undefined);

  useEffect(() => {
    if (state?.status === "ok" && open) {
      router.refresh();
      onClose();
    }
  }, [state, open, onClose, router]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={entry ? "Edit deposit" : "Add deposit"}
    >
      <form action={action} className="space-y-4">
        {entry && <input type="hidden" name="id" value={entry.id} />}
        <input type="hidden" name="kind" value="DEPOSIT" />
        <Field label="Property" htmlFor="dep-property">
          <select
            id="dep-property"
            name="propertyId"
            required
            defaultValue={entry?.propertyId ?? ""}
            className="h-11 w-full rounded-xl border-2 border-[var(--color-border)] bg-white px-3 text-sm font-medium transition-colors hover:border-[#cbd5d3] focus:border-[var(--color-brand)] focus:outline-none focus:ring-[3px] focus:ring-[var(--color-brand)]/25"
          >
            <option value="" disabled>
              Select a property…
            </option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" htmlFor="dep-date">
            <Input
              id="dep-date"
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
          <Field label="Amount (AED)" htmlFor="dep-amount">
            <Input
              id="dep-amount"
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
          label="Description"
          htmlFor="dep-description"
          hint="Optional — note what the deposit is for"
        >
          <Textarea
            id="dep-description"
            name="description"
            defaultValue={entry?.description ?? ""}
            placeholder="Guest XYZ — security deposit"
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

function RefundModal({
  deposit,
  locale,
  onClose,
}: {
  deposit: Entry | null;
  locale: Locale;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<
    CompanyExpenseState | undefined,
    FormData
  >(refundDepositAction, undefined);
  const ranOnceRef = useRef(false);

  useEffect(() => {
    if (state?.status === "ok" && !ranOnceRef.current) {
      ranOnceRef.current = true;
      router.refresh();
      onClose();
    }
  }, [state, onClose, router]);

  return (
    <Sheet
      open={!!deposit}
      onClose={onClose}
      title="Refund deposit"
      description={
        deposit
          ? `${deposit.propertyName ?? "—"} · ${formatCurrency(deposit.amount, "AED", locale)} held since ${formatDate(deposit.date, locale)}`
          : undefined
      }
    >
      {deposit && (
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={deposit.id} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Refund date" htmlFor="rf-date">
              <Input
                id="rf-date"
                name="refundedAt"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </Field>
            <Field
              label="Refund amount (AED)"
              htmlFor="rf-amount"
              hint={
                deposit.amount
                  ? `Held: ${formatCurrency(deposit.amount, "AED", locale)}`
                  : undefined
              }
            >
              <Input
                id="rf-amount"
                name="refundedAmount"
                type="number"
                step="0.01"
                min="0"
                required
                defaultValue={deposit.amount}
              />
            </Field>
          </div>
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
              Confirm refund
            </Button>
          </div>
        </form>
      )}
    </Sheet>
  );
}

function MonthPicker({
  name = "monthKey",
  defaultValue,
}: {
  name?: string;
  defaultValue?: string;
}) {
  const opts = monthOptions();
  const current = opts.find((o) => o.label === monthLabel(new Date()))?.key;
  return (
    <Field label="Bill into" htmlFor={`bill-${name}`}>
      <select
        id={`bill-${name}`}
        name={name}
        defaultValue={defaultValue ?? current}
        className="h-11 w-full rounded-xl border-2 border-[var(--color-border)] bg-white px-3 text-sm font-medium transition-colors hover:border-[#cbd5d3] focus:border-[var(--color-brand)] focus:outline-none focus:ring-[3px] focus:ring-[var(--color-brand)]/25"
      >
        {opts.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
