"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Edit3, Trash2 } from "lucide-react";
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

type Expense = {
  id: string;
  date: string;
  category: CompanyExpenseCategoryKey;
  description: string;
  amount: number;
};

export function CompanyExpensesView({
  locale,
  expenses,
  total,
}: {
  locale: Locale;
  expenses: Expense[];
  total: number;
}) {
  const [editing, setEditing] = useState<Expense | null | undefined>(undefined);
  const [deletePending, startDelete] = useTransition();
  const router = useRouter();

  return (
    <div>
      <PageHeader
        title="Company expenses"
        subtitle={
          <span className="text-sm text-[var(--color-muted)]">
            Costs the company itself bears (salaries, rent, software). Separate
            from per-property owner expenses.
          </span>
        }
        right={
          <Button onClick={() => setEditing(null)}>
            <Plus className="h-4 w-4" />
            Add expense
          </Button>
        }
      />

      <div
        className="mb-5 flex items-center justify-between rounded-2xl border border-rose-500/20 bg-rose-500/5 px-5 py-4"
      >
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Total · {expenses.length} entries
        </div>
        <div className="text-2xl font-bold tabular-nums text-rose-600">
          {formatCurrency(total, "AED", locale)}
        </div>
      </div>

      {expenses.length === 0 ? (
        <Card className="grid place-items-center px-6 py-16 text-center">
          <p className="text-sm text-[var(--color-muted)]">
            No company expenses recorded yet.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface-2)] text-xs uppercase tracking-wider text-[var(--color-muted)]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Category</th>
                  <th className="px-4 py-3 text-left font-semibold">Description</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr
                    key={e.id}
                    className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]/60"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDate(e.date, locale)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                          COMPANY_EXPENSE_CATEGORY_TONE[e.category],
                        )}
                      >
                        {COMPANY_EXPENSE_CATEGORY_LABELS[e.category]}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[360px] truncate">
                      {e.description}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-rose-600">
                      − {formatCurrency(e.amount, "AED", locale)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditing(e)}
                          aria-label="Edit"
                          className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-foreground)]"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm("Delete this expense?")) {
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
        key={editing?.id ?? "new"}
        open={editing !== undefined}
        expense={editing ?? null}
        onClose={() => setEditing(undefined)}
      />
    </div>
  );
}

function ExpenseEditor({
  open,
  expense,
  onClose,
}: {
  open: boolean;
  expense: Expense | null;
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
      title={expense ? "Edit company expense" : "Add company expense"}
    >
      <form action={action} className="space-y-4">
        {expense && <input type="hidden" name="id" value={expense.id} />}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" htmlFor="date">
            <Input
              id="date"
              name="date"
              type="date"
              required
              defaultValue={
                expense?.date
                  ? expense.date.slice(0, 10)
                  : new Date().toISOString().slice(0, 10)
              }
            />
          </Field>
          <Field label="Category" htmlFor="category">
            <select
              id="category"
              name="category"
              required
              defaultValue={expense?.category ?? "OTHER"}
              className="h-11 w-full rounded-xl border-2 border-[var(--color-border)] bg-white px-3 text-sm font-medium transition-colors hover:border-[#cbd5d3] focus:border-[var(--color-brand)] focus:outline-none focus:ring-[3px] focus:ring-[var(--color-brand)]/25"
            >
              {COMPANY_EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {COMPANY_EXPENSE_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Amount (AED)" htmlFor="amount">
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={expense?.amount || ""}
          />
        </Field>
        <Field label="Description" htmlFor="description">
          <Textarea
            id="description"
            name="description"
            required
            defaultValue={expense?.description ?? ""}
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
