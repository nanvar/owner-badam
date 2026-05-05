"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Edit3, Trash2, Receipt, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Field, Textarea } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { PageHeader } from "@/components/app-shell";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import {
  upsertCompanyExpenseAction,
  deleteCompanyExpenseAction,
  type CompanyExpenseState,
} from "@/app/actions/company-expenses";
import {
  COMPANY_EXPENSE_CATEGORIES,
  COMPANY_EXPENSE_CATEGORY_LABELS,
  COMPANY_EXPENSE_CATEGORY_TONE,
  type CompanyExpenseCategoryKey,
} from "@/lib/company-expense-types";
import type { Locale } from "@/i18n/config";

export type Kind = "EXPENSE" | "PROFIT";

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
};

type PropertyOption = { id: string; name: string; color: string };

export function CompanyFinancesView({
  locale,
  entries,
  properties,
}: {
  locale: Locale;
  entries: Entry[];
  properties: PropertyOption[];
}) {
  const [tab, setTab] = useState<Kind>("EXPENSE");
  // Separate editor state per kind so opening a profit modal can never inherit
  // an expense's data and vice versa.
  const [editingExpense, setEditingExpense] = useState<Entry | null | undefined>(
    undefined,
  );
  const [editingProfit, setEditingProfit] = useState<Entry | null | undefined>(
    undefined,
  );
  const [deletePending, startDelete] = useTransition();
  const router = useRouter();

  const expenses = entries.filter((e) => e.kind === "EXPENSE");
  const profits = entries.filter((e) => e.kind === "PROFIT");
  const visible = tab === "EXPENSE" ? expenses : profits;

  return (
    <div>
      <PageHeader title="Company finances" />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-[var(--color-border)] bg-white p-1">
          {(["EXPENSE", "PROFIT"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                tab === k
                  ? k === "EXPENSE"
                    ? "bg-rose-500 text-white"
                    : "bg-emerald-600 text-white"
                  : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]",
              )}
            >
              {k === "EXPENSE" ? (
                <Receipt className="h-3.5 w-3.5" />
              ) : (
                <TrendingUp className="h-3.5 w-3.5" />
              )}
              {k === "EXPENSE" ? "Expenses" : "Profit"}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px] font-bold",
                  tab === k
                    ? "bg-white/25 text-white"
                    : "bg-[var(--color-surface-2)] text-[var(--color-muted)]",
                )}
              >
                {k === "EXPENSE" ? expenses.length : profits.length}
              </span>
            </button>
          ))}
        </div>
        <Button
          className="ml-auto"
          onClick={() =>
            tab === "EXPENSE"
              ? setEditingExpense(null)
              : setEditingProfit(null)
          }
        >
          <Plus className="h-4 w-4" />
          {tab === "EXPENSE" ? "Add expense" : "Add profit"}
        </Button>
      </div>

      {visible.length === 0 ? (
        <Card className="grid place-items-center px-6 py-16 text-center">
          <p className="text-sm text-[var(--color-muted)]">
            {tab === "EXPENSE"
              ? "No expenses recorded yet."
              : "No profit recorded yet."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
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
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((e) => (
                  <tr
                    key={e.id}
                    className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]/60"
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
                    <td className="px-4 py-3 max-w-[360px] truncate">
                      {e.description}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right tabular-nums font-semibold",
                        e.kind === "EXPENSE"
                          ? "text-rose-600"
                          : "text-emerald-700",
                      )}
                    >
                      {e.kind === "EXPENSE" ? "− " : "+ "}
                      {formatCurrency(e.amount, "AED", locale)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() =>
                            e.kind === "EXPENSE"
                              ? setEditingExpense(e)
                              : setEditingProfit(e)
                          }
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
    </div>
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
