"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus, Edit3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input, Field, Textarea } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { PageHeader } from "@/components/app-shell";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import {
  upsertExpenseAction,
  deleteExpenseAction,
  type ExpenseState,
} from "@/app/actions/expenses";
import {
  EXPENSE_TYPES,
  EXPENSE_TYPE_LABELS,
  EXPENSE_TYPE_TONE,
  type ExpenseTypeKey,
} from "@/lib/expense-types";
import type { Locale } from "@/i18n/config";

type Property = { id: string; name: string; color: string };

type Expense = {
  id: string;
  propertyId: string;
  propertyName: string;
  propertyColor: string;
  date: string;
  type: ExpenseTypeKey;
  description: string;
  amount: number;
};

export function LedgerView({
  locale,
  initialPropertyId,
  properties,
  expenses,
  labels,
}: {
  locale: Locale;
  initialPropertyId: string;
  properties: Property[];
  expenses: Expense[];
  labels: Record<string, string>;
}) {
  const [propertyFilter, setPropertyFilter] = useState<string>(initialPropertyId);
  const [editingExpense, setEditingExpense] = useState<Expense | null | undefined>(undefined);
  const [deletePending, startDelete] = useTransition();

  const filteredExpenses = propertyFilter
    ? expenses.filter((e) => e.propertyId === propertyFilter)
    : expenses;

  return (
    <div>
      <PageHeader
        title={labels.title}
        right={
          <Button onClick={() => setEditingExpense(null)}>
            <Plus className="h-4 w-4" />
            {labels.addExpense}
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={propertyFilter}
          onChange={(e) => setPropertyFilter(e.target.value)}
          className="ml-auto h-9 rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm font-medium"
        >
          <option value="">{labels.all}</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {filteredExpenses.length === 0 ? (
        <EmptyState text={labels.noEntries} />
      ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-surface-2)] text-xs uppercase tracking-wider text-[var(--color-muted)]">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">{labels.date}</th>
                    <th className="px-4 py-3 text-left font-semibold">{labels.property}</th>
                    <th className="px-4 py-3 text-left font-semibold">{labels.type}</th>
                    <th className="px-4 py-3 text-left font-semibold">{labels.description}</th>
                    <th className="px-4 py-3 text-right font-semibold">{labels.amount}</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((e) => (
                    <tr
                      key={e.id}
                      className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]/60"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatDate(e.date, locale)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-6 w-1 shrink-0 rounded-full"
                            style={{ background: e.propertyColor }}
                          />
                          <span className="font-medium">{e.propertyName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                            EXPENSE_TYPE_TONE[e.type],
                          )}
                        >
                          {EXPENSE_TYPE_LABELS[e.type]}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[280px] truncate">
                        {e.description}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-rose-600">
                        − {formatCurrency(e.amount, "AED", locale)}
                      </td>
                      <td className="px-4 py-3">
                        <RowActions
                          onEdit={() => setEditingExpense(e)}
                          onDelete={() =>
                            confirm(labels.deleteConfirm) &&
                            startDelete(() => deleteExpenseAction(e.id))
                          }
                          deletePending={deletePending}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
      )}

      <ExpenseEditor
        open={editingExpense !== undefined}
        expense={editingExpense ?? null}
        properties={properties}
        defaultPropertyId={propertyFilter || properties[0]?.id || ""}
        labels={labels}
        onClose={() => setEditingExpense(undefined)}
      />
    </div>
  );
}

function RowActions({
  onEdit,
  onDelete,
  deletePending,
}: {
  onEdit: () => void;
  onDelete: () => void;
  deletePending: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        onClick={onEdit}
        aria-label="Edit"
        className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-foreground)]"
      >
        <Edit3 className="h-4 w-4" />
      </button>
      <button
        onClick={onDelete}
        disabled={deletePending}
        aria-label="Delete"
        className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <Card>
      <CardBody className="py-12 text-center text-sm text-[var(--color-muted)]">
        {text}
      </CardBody>
    </Card>
  );
}

function ExpenseEditor({
  open,
  expense,
  properties,
  defaultPropertyId,
  labels,
  onClose,
}: {
  open: boolean;
  expense: Expense | null;
  properties: Property[];
  defaultPropertyId: string;
  labels: Record<string, string>;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<ExpenseState | undefined, FormData>(
    upsertExpenseAction,
    undefined,
  );

  if (state?.status === "ok" && open) {
    queueMicrotask(onClose);
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={expense ? labels.editExpense : labels.addExpense}
    >
      <form action={action} className="space-y-4">
        {expense && <input type="hidden" name="id" value={expense.id} />}
        <Field label={labels.property} htmlFor="propertyId">
          <select
            id="propertyId"
            name="propertyId"
            required
            defaultValue={expense?.propertyId ?? defaultPropertyId}
            className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm"
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={labels.date} htmlFor="date">
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
          <Field label={labels.type} htmlFor="type">
            <select
              id="type"
              name="type"
              required
              defaultValue={expense?.type ?? "OTHERS"}
              className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm"
            >
              {EXPENSE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {EXPENSE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label={`${labels.amount} (${labels.currency})`} htmlFor="amount">
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={expense?.amount || ""}
          />
        </Field>
        <Field label={labels.description} htmlFor="description">
          <Textarea
            id="description"
            name="description"
            required
            defaultValue={expense?.description ?? ""}
            placeholder="Paid Outstanding DEWA Bill — Address Opera 2001"
          />
        </Field>
        {state?.status === "error" && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600">
            {state.message}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {labels.cancel}
          </Button>
          <Button type="submit" loading={pending}>
            {labels.save}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

