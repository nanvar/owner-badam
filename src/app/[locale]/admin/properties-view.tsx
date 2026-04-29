"use client";

import { useActionState, useState, useTransition } from "react";
import {
  Plus,
  RefreshCw,
  Edit3,
  Trash2,
  Building2,
  Calendar as CalendarIcon,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input, Field, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { PageHeader } from "@/components/app-shell";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import {
  upsertPropertyAction,
  deletePropertyAction,
  type PropertyState,
} from "@/app/actions/properties";
import { syncAllAction, syncOneAction, type SyncState } from "@/app/actions/sync";
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

type Property = {
  id: string;
  name: string;
  address: string | null;
  airbnbIcalUrl: string | null;
  basePrice: number;
  cleaningFee: number;
  color: string;
  notes: string | null;
  ownerId: string;
  ownerName: string;
  reservationCount: number;
  lastSyncedAt: string | null;
};

type Owner = { id: string; name: string | null; email: string };

type ExpenseEntry = {
  id: string;
  propertyId: string;
  date: string;
  type: ExpenseTypeKey;
  description: string;
  amount: number;
};

type Labels = Record<string, string>;

export function PropertiesView({
  locale,
  properties,
  owners,
  labels,
  lockedOwnerId,
  hideTitle,
  expenses,
}: {
  locale: Locale;
  properties: Property[];
  owners: Owner[];
  labels: Labels;
  lockedOwnerId?: string;
  hideTitle?: boolean;
  expenses?: ExpenseEntry[];
}) {
  const [editing, setEditing] = useState<Property | null | undefined>(undefined);
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [syncPending, startSync] = useTransition();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deletePending, startDelete] = useTransition();
  const [expensesProperty, setExpensesProperty] = useState<Property | null>(null);

  const expensesByProperty = (expenses ?? []).reduce<Record<string, ExpenseEntry[]>>(
    (acc, e) => {
      (acc[e.propertyId] ||= []).push(e);
      return acc;
    },
    {},
  );
  const showExpenseColumn = !!expenses;

  return (
    <div>
      {!hideTitle && (
        <PageHeader
          title={labels.title}
          right={
            <>
              {!lockedOwnerId && (
                <Button
                  variant="secondary"
                  loading={syncPending}
                  onClick={() =>
                    startSync(async () => {
                      const r = await syncAllAction();
                      setSyncState(r);
                    })
                  }
                >
                  <RefreshCw className="h-4 w-4" />
                  {syncPending ? labels.syncing : labels.syncNow}
                </Button>
              )}
              <Button onClick={() => setEditing(null)}>
                <Plus className="h-4 w-4" />
                {labels.addProperty}
              </Button>
            </>
          }
        />
      )}

      {hideTitle && (
        <div className="mb-3 flex justify-end">
          <Button onClick={() => setEditing(null)}>
            <Plus className="h-4 w-4" />
            {labels.addProperty}
          </Button>
        </div>
      )}

      {!lockedOwnerId && syncState && syncState.status === "ok" && (
        <SyncSummary
          results={syncState.results}
          onClose={() => setSyncState(null)}
        />
      )}
      {!lockedOwnerId && syncState && syncState.status === "error" && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600">
          <AlertTriangle className="h-4 w-4" />
          {syncState.message}
        </div>
      )}

      {properties.length === 0 ? (
        <EmptyState label={labels.noProperties} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {properties.map((p) => (
            <PropertyCard
              key={p.id}
              property={p}
              labels={labels}
              locale={locale}
              hideOwner={!!lockedOwnerId}
              hideSync={!!lockedOwnerId}
              expenses={
                showExpenseColumn ? expensesByProperty[p.id] ?? [] : null
              }
              onShowExpenses={() => setExpensesProperty(p)}
              onEdit={() => setEditing(p)}
              onDelete={() => setDeleteId(p.id)}
              onSync={async () => {
                const r = await syncOneAction(p.id);
                setSyncState(r);
              }}
            />
          ))}
        </div>
      )}

      <PropertyEditor
        open={editing !== undefined}
        property={editing ?? null}
        owners={owners}
        lockedOwnerId={lockedOwnerId}
        labels={labels}
        onClose={() => setEditing(undefined)}
      />

      {showExpenseColumn && (
        <PropertyExpensesDrawer
          open={!!expensesProperty}
          property={expensesProperty}
          expenses={
            expensesProperty
              ? expensesByProperty[expensesProperty.id] ?? []
              : []
          }
          locale={locale}
          labels={labels}
          onClose={() => setExpensesProperty(null)}
        />
      )}

      <Sheet
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title={labels.delete}
      >
        <p className="text-sm text-[var(--color-muted)]">{labels.deleteConfirm}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>
            {labels.cancel}
          </Button>
          <Button
            variant="danger"
            loading={deletePending}
            onClick={() =>
              deleteId &&
              startDelete(async () => {
                await deletePropertyAction(deleteId);
                setDeleteId(null);
              })
            }
          >
            <Trash2 className="h-4 w-4" />
            {labels.delete}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

function PropertyCard({
  property,
  labels,
  locale,
  hideOwner,
  hideSync,
  expenses,
  onShowExpenses,
  onEdit,
  onDelete,
  onSync,
}: {
  property: Property;
  labels: Labels;
  locale: Locale;
  hideOwner?: boolean;
  hideSync?: boolean;
  expenses: ExpenseEntry[] | null;
  onShowExpenses: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSync: () => Promise<void>;
}) {
  const [pending, start] = useTransition();
  const expenseTotal = expenses
    ? expenses.reduce((s, e) => s + e.amount, 0)
    : 0;
  return (
    <div className="flex overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-sm transition-shadow hover:shadow-md">
      <span
        className="w-1.5 shrink-0"
        style={{ background: property.color }}
      />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-bold tracking-tight">
              {property.name}
            </div>
            {property.address && (
              <div className="mt-0.5 truncate text-xs text-[var(--color-muted)]">
                {property.address}
              </div>
            )}
            {!hideOwner && (
              <div className="mt-2">
                <Badge tone="brand">
                  <Building2 className="h-3 w-3" />
                  {property.ownerName}
                </Badge>
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {!hideSync && (
              <Button
                variant="ghost"
                size="sm"
                loading={pending}
                disabled={!property.airbnbIcalUrl}
                onClick={() => start(() => onSync())}
                title={labels.syncNow}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            )}
            <button
              onClick={onEdit}
              aria-label="Edit"
              className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-foreground)]"
            >
              <Edit3 className="h-4 w-4" />
            </button>
            <button
              onClick={onDelete}
              aria-label="Delete"
              className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-rose-500/10 hover:text-rose-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/50 px-3 py-2">
            <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              <CalendarIcon className="h-3 w-3" />
              {labels.reservations ?? "Res."}
            </div>
            <div className="mt-0.5 text-base font-bold tabular-nums">
              {property.reservationCount}
            </div>
          </div>
          {expenses && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-2">
              <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-rose-600/80">
                <Receipt className="h-3 w-3" />
                {labels.expenses}
              </div>
              <div className="mt-0.5 text-base font-bold tabular-nums text-rose-600">
                {expenses.length === 0
                  ? "—"
                  : formatCurrency(expenseTotal, "AED", locale)}
              </div>
            </div>
          )}
        </div>

        {expenses && (
          <button
            onClick={onShowExpenses}
            className="flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-semibold transition-colors hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
          >
            <Receipt className="h-3.5 w-3.5" />
            {labels.showExpenses}
            {expenses.length > 0 && (
              <span className="rounded-full bg-[var(--color-surface-2)] px-1.5 text-[10px] font-bold text-[var(--color-muted)]">
                {expenses.length}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function PropertyEditor({
  open,
  property,
  owners,
  lockedOwnerId,
  labels,
  onClose,
}: {
  open: boolean;
  property: Property | null;
  owners: Owner[];
  lockedOwnerId?: string;
  labels: Labels;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<PropertyState | undefined, FormData>(
    upsertPropertyAction,
    undefined,
  );
  const isEdit = !!property;

  if (state?.status === "ok" && open) {
    queueMicrotask(onClose);
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isEdit ? labels.editProperty : labels.addProperty}
    >
      <form action={action} className="space-y-4">
        {property && <input type="hidden" name="id" value={property.id} />}
        <Field label={labels.name} htmlFor="name">
          <Input
            id="name"
            name="name"
            required
            defaultValue={property?.name ?? ""}
            placeholder="Marina 2BR"
          />
        </Field>
        <Field label={labels.address} htmlFor="address">
          <Input
            id="address"
            name="address"
            defaultValue={property?.address ?? ""}
            placeholder="Dubai Marina, Tower 5"
          />
        </Field>
        <Field
          label={labels.icalUrl}
          htmlFor="airbnbIcalUrl"
          hint="Airbnb → Calendar → Export → copy iCal link"
        >
          <Input
            id="airbnbIcalUrl"
            name="airbnbIcalUrl"
            type="url"
            defaultValue={property?.airbnbIcalUrl ?? ""}
            placeholder="https://www.airbnb.com/calendar/ical/..."
          />
        </Field>
        {lockedOwnerId ? (
          <input type="hidden" name="ownerId" value={lockedOwnerId} />
        ) : null}
        <div
          className={
            lockedOwnerId ? "grid grid-cols-1 gap-3" : "grid grid-cols-2 gap-3"
          }
        >
          {!lockedOwnerId && (
            <Field label={labels.owner} htmlFor="ownerId">
              <select
                id="ownerId"
                name="ownerId"
                required
                defaultValue={property?.ownerId ?? owners[0]?.id ?? ""}
                className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-white px-3.5 text-sm"
              >
                {owners.length === 0 && (
                  <option value="">— no owners yet —</option>
                )}
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name ?? o.email}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label={labels.color} htmlFor="color">
            <Input
              id="color"
              name="color"
              type="color"
              defaultValue={property?.color ?? "#4f8a6f"}
              className="h-11 w-full rounded-xl p-1"
            />
          </Field>
        </div>
        <Field label={labels.notes} htmlFor="notes">
          <Textarea
            id="notes"
            name="notes"
            defaultValue={property?.notes ?? ""}
            placeholder="Internal notes (Wi-Fi codes, instructions...)"
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

export function SyncSummary({ results, onClose }: { results: { propertyName: string; ok: boolean; created: number; updated: number; skipped: number; error?: string }[]; onClose: () => void }) {
  const totalCreated = results.reduce((s, r) => s + r.created, 0);
  const failed = results.filter((r) => !r.ok);
  const hasFailures = failed.length > 0;
  return (
    <div
      className={cn(
        "mb-5 flex animate-fade-in items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm",
        hasFailures
          ? "border-rose-500/30 bg-rose-500/5 text-rose-600"
          : "border-emerald-500/30 bg-emerald-500/5",
      )}
    >
      <div className="flex items-center gap-2">
        {hasFailures ? (
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
        ) : (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
        )}
        <span className="font-semibold">
          {totalCreated === 0
            ? "No new reservations"
            : `${totalCreated} new reservation${totalCreated === 1 ? "" : "s"}`}
          {hasFailures && ` · ${failed.length} failed`}
        </span>
      </div>
      <button
        onClick={onClose}
        className="rounded-lg p-1 text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]"
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <Card className="grid place-items-center gap-3 px-6 py-14 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
        <Building2 className="h-7 w-7" />
      </div>
      <p className="text-sm text-[var(--color-muted)]">{label}</p>
    </Card>
  );
}

function PropertyExpensesDrawer({
  open,
  property,
  expenses,
  locale,
  labels,
  onClose,
}: {
  open: boolean;
  property: Property | null;
  expenses: ExpenseEntry[];
  locale: Locale;
  labels: Labels;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState<ExpenseEntry | null | undefined>(
    undefined,
  );
  const [deletePending, startDelete] = useTransition();
  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <Sheet
      open={open && !!property}
      onClose={onClose}
      side="right"
      title={property?.name}
      description={property?.address ?? undefined}
    >
      <div
        className="flex items-center justify-between rounded-2xl border border-rose-500/20 bg-rose-500/5 px-4 py-3"
      >
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            {labels.total} · {expenses.length}
          </div>
          <div className="mt-0.5 text-xl font-bold text-rose-600">
            {formatCurrency(total, "AED", locale)}
          </div>
        </div>
        <Button onClick={() => setEditing(null)}>
          <Plus className="h-4 w-4" />
          {labels.addExpense}
        </Button>
      </div>

      {expenses.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-[var(--color-border)] bg-white px-4 py-10 text-center text-sm text-[var(--color-muted)]">
          {labels.noExpenses}
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {expenses.map((e) => (
            <li
              key={e.id}
              className="flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                      EXPENSE_TYPE_TONE[e.type],
                    )}
                  >
                    {EXPENSE_TYPE_LABELS[e.type]}
                  </span>
                  <span className="text-[10px] text-[var(--color-muted)]">
                    {formatDate(e.date, locale)}
                  </span>
                </div>
                <div className="mt-1 truncate text-sm font-medium">
                  {e.description}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-rose-600 tabular-nums">
                  − {formatCurrency(e.amount, "AED", locale)}
                </div>
                <div className="mt-1 flex items-center justify-end gap-1">
                  <button
                    onClick={() => setEditing(e)}
                    aria-label="Edit"
                    className="rounded-lg p-1 text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-foreground)]"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    disabled={deletePending}
                    onClick={() => {
                      if (!confirm(labels.deleteLedgerConfirm)) return;
                      startDelete(() => deleteExpenseAction(e.id));
                    }}
                    aria-label="Delete"
                    className="rounded-lg p-1 text-[var(--color-muted)] hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {property && (
        <ExpenseEditor
          open={editing !== undefined}
          expense={editing ?? null}
          propertyId={property.id}
          labels={labels}
          onClose={() => setEditing(undefined)}
        />
      )}
    </Sheet>
  );
}

function ExpenseEditor({
  open,
  expense,
  propertyId,
  labels,
  onClose,
}: {
  open: boolean;
  expense: ExpenseEntry | null;
  propertyId: string;
  labels: Labels;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<
    ExpenseState | undefined,
    FormData
  >(upsertExpenseAction, undefined);

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
        <input type="hidden" name="propertyId" value={propertyId} />
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
        <Field
          label={`${labels.amount} (${labels.currency})`}
          htmlFor="amount"
        >
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
            placeholder="Paid Outstanding DEWA Bill"
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
