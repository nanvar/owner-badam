"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
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
  ChevronRight,
  X,
  Wallet,
  MoreHorizontal,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input, Field, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  createOwnerPaymentAction,
  deleteOwnerPaymentAction,
  type OwnerPaymentState,
} from "@/app/actions/owner-payments";
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
  airbnbUrl: string | null;
  basePrice: number;
  cleaningFee: number;
  color: string;
  notes: string | null;
  ownerId: string;
  ownerName: string;
  reservationCount: number;
  lastSyncedAt: string | null;
  createdAt?: string;
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

type PaymentEntry = {
  id: string;
  propertyId: string | null;
  date: string;
  amount: number;
  method: string | null;
  reference: string | null;
  notes: string | null;
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
  payments,
}: {
  locale: Locale;
  properties: Property[];
  owners: Owner[];
  labels: Labels;
  lockedOwnerId?: string;
  hideTitle?: boolean;
  expenses?: ExpenseEntry[];
  payments?: PaymentEntry[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Property | null | undefined>(undefined);
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [syncPending, startSync] = useTransition();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deletePending, startDelete] = useTransition();
  const [expensesProperty, setExpensesProperty] = useState<Property | null>(null);
  const [paymentsProperty, setPaymentsProperty] = useState<Property | null>(null);

  const expensesByProperty = (expenses ?? []).reduce<Record<string, ExpenseEntry[]>>(
    (acc, e) => {
      (acc[e.propertyId] ||= []).push(e);
      return acc;
    },
    {},
  );
  const paymentsByProperty = (payments ?? []).reduce<Record<string, PaymentEntry[]>>(
    (acc, p) => {
      if (!p.propertyId) return acc;
      (acc[p.propertyId] ||= []).push(p);
      return acc;
    },
    {},
  );
  const showExpenseColumn = !!expenses;
  const showPaymentsColumn = !!payments;

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
                      if (r.status === "ok") router.refresh();
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
      ) : lockedOwnerId ? (
        <PropertyTable
          properties={properties}
          labels={labels}
          locale={locale}
          expensesByProperty={expensesByProperty}
          paymentsByProperty={paymentsByProperty}
          showExpenseColumn={showExpenseColumn}
          showPaymentsColumn={showPaymentsColumn}
          onShowExpenses={(p) => setExpensesProperty(p)}
          onRecordPayment={(p) => setPaymentsProperty(p)}
          onEdit={(p) => setEditing(p)}
          onDelete={(id) => setDeleteId(id)}
        />
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
              payments={
                showPaymentsColumn ? paymentsByProperty[p.id] ?? [] : null
              }
              onShowExpenses={() => setExpensesProperty(p)}
              onRecordPayment={() => setPaymentsProperty(p)}
              onEdit={() => setEditing(p)}
              onDelete={() => setDeleteId(p.id)}
              onSync={async () => {
                const r = await syncOneAction(p.id);
                setSyncState(r);
                if (r.status === "ok") router.refresh();
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

      {showPaymentsColumn && (
        <PropertyPaymentsDrawer
          open={!!paymentsProperty}
          property={paymentsProperty}
          payments={
            paymentsProperty
              ? paymentsByProperty[paymentsProperty.id] ?? []
              : []
          }
          locale={locale}
          labels={labels}
          onClose={() => setPaymentsProperty(null)}
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
                router.refresh();
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
  payments,
  onShowExpenses,
  onRecordPayment,
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
  payments: PaymentEntry[] | null;
  onShowExpenses: () => void;
  onRecordPayment: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSync: () => Promise<void>;
}) {
  const [pending, start] = useTransition();
  const expenseTotal = expenses
    ? expenses.reduce((s, e) => s + e.amount, 0)
    : 0;
  const paymentTotal = payments
    ? payments.reduce((s, p) => s + p.amount, 0)
    : 0;
  const detailHref = `/${locale}/admin/owners/${property.ownerId}/properties/${property.id}`;
  return (
    <div className="flex overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-sm transition-shadow hover:shadow-md">
      <span
        className="w-1.5 shrink-0"
        style={{ background: property.color }}
      />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link href={detailHref} className="group min-w-0 flex-1">
            <div className="flex items-center gap-1 truncate text-sm font-bold tracking-tight group-hover:text-[var(--color-brand)]">
              {property.name}
              <ChevronRight className="h-3.5 w-3.5 text-[var(--color-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-brand)]" />
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
          </Link>
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

        <div className="grid grid-cols-3 gap-2">
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
          {payments && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
              <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700/80">
                <Wallet className="h-3 w-3" />
                {labels.paid ?? "Paid"}
              </div>
              <div className="mt-0.5 text-base font-bold tabular-nums text-emerald-700">
                {payments.length === 0
                  ? "—"
                  : formatCurrency(paymentTotal, "AED", locale)}
              </div>
            </div>
          )}
        </div>

        <div
          className={cn(
            "grid gap-2",
            expenses && payments ? "grid-cols-2" : "grid-cols-1",
          )}
        >
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
          {payments && (
            <button
              onClick={onRecordPayment}
              className="flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-semibold transition-colors hover:border-emerald-500 hover:text-emerald-700"
            >
              <Wallet className="h-3.5 w-3.5" />
              {labels.recordPayment ?? "Record payment"}
              {payments.length > 0 && (
                <span className="rounded-full bg-[var(--color-surface-2)] px-1.5 text-[10px] font-bold text-[var(--color-muted)]">
                  {payments.length}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PropertyTable({
  properties,
  labels,
  locale,
  expensesByProperty,
  paymentsByProperty,
  showExpenseColumn,
  showPaymentsColumn,
  onShowExpenses,
  onRecordPayment,
  onEdit,
  onDelete,
}: {
  properties: Property[];
  labels: Labels;
  locale: Locale;
  expensesByProperty: Record<string, ExpenseEntry[]>;
  paymentsByProperty: Record<string, PaymentEntry[]>;
  showExpenseColumn: boolean;
  showPaymentsColumn: boolean;
  onShowExpenses: (p: Property) => void;
  onRecordPayment: (p: Property) => void;
  onEdit: (p: Property) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="overflow-visible">
      <table className="grid-table w-full text-sm">
        <thead className="bg-[var(--color-surface-2)] text-xs uppercase tracking-wider text-[var(--color-muted)]">
          <tr>
            <th className="px-3 py-3 text-left font-semibold">
              {labels.name ?? "Name"}
            </th>
            <th className="w-32 px-3 py-3 text-right font-semibold">
              <span className="inline-flex items-center gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5" />
                {labels.reservations ?? "Reservations"}
              </span>
            </th>
            {showExpenseColumn && (
              <th className="w-36 px-3 py-3 text-right font-semibold">
                <span className="inline-flex items-center gap-1.5">
                  <Receipt className="h-3.5 w-3.5" />
                  {labels.expenses ?? "Expenses"}
                </span>
              </th>
            )}
            {showPaymentsColumn && (
              <th className="w-36 px-3 py-3 text-right font-semibold">
                <span className="inline-flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5" />
                  {labels.paid ?? "Paid"}
                </span>
              </th>
            )}
            <th className="w-12 px-1 py-3" />
          </tr>
        </thead>
        <tbody>
          {properties.map((p) => {
            const expenses = showExpenseColumn
              ? expensesByProperty[p.id] ?? []
              : [];
            const payments = showPaymentsColumn
              ? paymentsByProperty[p.id] ?? []
              : [];
            const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
            const paymentTotal = payments.reduce((s, e) => s + e.amount, 0);
            const detailHref = `/${locale}/admin/owners/${p.ownerId}/properties/${p.id}`;
            return (
              <tr
                key={p.id}
                className="hover:bg-[var(--color-surface-2)]/60"
              >
                <td className="px-3 py-3">
                  <Link
                    href={detailHref}
                    className="group flex items-center gap-3"
                  >
                    <span
                      className="h-9 w-1 shrink-0 rounded-full"
                      style={{ background: p.color }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 truncate font-semibold tracking-tight group-hover:text-[var(--color-brand)]">
                        {p.name}
                        <ChevronRight className="h-3.5 w-3.5 text-[var(--color-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-brand)]" />
                      </span>
                      {p.address && (
                        <span className="block truncate text-xs text-[var(--color-muted)]">
                          {p.address}
                        </span>
                      )}
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  <span className="inline-flex min-w-[2rem] items-center justify-center rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-xs font-semibold text-[var(--color-foreground)]">
                    {p.reservationCount}
                  </span>
                </td>
                {showExpenseColumn && (
                  <td className="px-3 py-3 text-right tabular-nums">
                    {expenses.length === 0 ? (
                      <span className="text-[var(--color-muted)]">—</span>
                    ) : (
                      <span className="font-semibold text-rose-600">
                        {formatCurrency(expenseTotal, "AED", locale)}
                      </span>
                    )}
                  </td>
                )}
                {showPaymentsColumn && (
                  <td className="px-3 py-3 text-right tabular-nums">
                    {payments.length === 0 ? (
                      <span className="text-[var(--color-muted)]">—</span>
                    ) : (
                      <span className="font-semibold text-emerald-700">
                        {formatCurrency(paymentTotal, "AED", locale)}
                      </span>
                    )}
                  </td>
                )}
                <td className="px-1 py-3 text-right">
                  <RowMenu
                    labels={labels}
                    detailHref={detailHref}
                    expensesCount={expenses.length}
                    paymentsCount={payments.length}
                    showExpenses={showExpenseColumn}
                    showPayments={showPaymentsColumn}
                    onShowExpenses={() => onShowExpenses(p)}
                    onRecordPayment={() => onRecordPayment(p)}
                    onEdit={() => onEdit(p)}
                    onDelete={() => onDelete(p.id)}
                  />
                </td>
              </tr>
              );
            })}
        </tbody>
      </table>
    </Card>
  );
}

function RowMenu({
  labels,
  detailHref,
  expensesCount,
  paymentsCount,
  showExpenses,
  showPayments,
  onShowExpenses,
  onRecordPayment,
  onEdit,
  onDelete,
}: {
  labels: Labels;
  detailHref: string;
  expensesCount: number;
  paymentsCount: number;
  showExpenses: boolean;
  showPayments: boolean;
  onShowExpenses: () => void;
  onRecordPayment: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Actions"
        className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-foreground)]"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-56 origin-top-right overflow-hidden rounded-xl border border-[var(--color-border)] bg-white py-1 shadow-lg shadow-black/10 ring-1 ring-black/5 animate-fade-in">
          <Link
            href={detailHref}
            onClick={close}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-2)]"
          >
            <span className="shrink-0 text-[var(--color-muted)]">
              <ExternalLink className="h-4 w-4" />
            </span>
            <span className="flex-1">
              {labels.showProperty ?? "Show property"}
            </span>
          </Link>
          <div className="my-1 h-px bg-[var(--color-border)]" />
          {showExpenses && (
            <MenuItem
              icon={<Receipt className="h-4 w-4" />}
              label={labels.expenses ?? "Expenses"}
              count={expensesCount}
              onClick={() => {
                close();
                onShowExpenses();
              }}
            />
          )}
          {showPayments && (
            <MenuItem
              icon={<Wallet className="h-4 w-4" />}
              label={labels.payments ?? "Payments"}
              count={paymentsCount}
              onClick={() => {
                close();
                onRecordPayment();
              }}
            />
          )}
          <MenuItem
            icon={<Edit3 className="h-4 w-4" />}
            label={labels.edit ?? "Edit"}
            onClick={() => {
              close();
              onEdit();
            }}
          />
          <div className="my-1 h-px bg-[var(--color-border)]" />
          <MenuItem
            icon={<Trash2 className="h-4 w-4" />}
            label={labels.delete ?? "Delete"}
            danger
            onClick={() => {
              close();
              onDelete();
            }}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  count,
  danger,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        danger
          ? "text-rose-600 hover:bg-rose-500/10"
          : "text-[var(--color-foreground)] hover:bg-[var(--color-surface-2)]",
      )}
    >
      <span className="shrink-0 text-[var(--color-muted)]">{icon}</span>
      <span className="flex-1">{label}</span>
      {typeof count === "number" && count > 0 && (
        <span className="rounded-full bg-[var(--color-surface-2)] px-1.5 text-[10px] font-bold text-[var(--color-muted)]">
          {count}
        </span>
      )}
    </button>
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
  const router = useRouter();
  const [state, action, pending] = useActionState<PropertyState | undefined, FormData>(
    upsertPropertyAction,
    undefined,
  );
  const isEdit = !!property;

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
        <Field
          label="Airbnb listing URL"
          htmlFor="airbnbUrl"
          hint="Public link to the Airbnb listing — used to import photos & details"
        >
          <Input
            id="airbnbUrl"
            name="airbnbUrl"
            type="url"
            defaultValue={property?.airbnbUrl ?? ""}
            placeholder="https://www.airbnb.com/rooms/..."
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
                className="h-11 w-full rounded-xl border-2 border-[var(--color-border)] bg-white px-3.5 text-sm font-medium transition-colors hover:border-[#cbd5d3] focus:border-[var(--color-brand)] focus:outline-none focus:ring-[3px] focus:ring-[var(--color-brand)]/25"
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
        <Field
          label="Added on"
          htmlFor="createdAt"
          hint="Drives the months available in the owner's reports"
        >
          <Input
            id="createdAt"
            name="createdAt"
            type="date"
            defaultValue={
              property?.createdAt ? property.createdAt.slice(0, 10) : ""
            }
            max={new Date().toISOString().slice(0, 10)}
          />
        </Field>
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
  const totalUpdated = results.reduce((s, r) => s + r.updated, 0);
  const totalSkipped = results.reduce((s, r) => s + r.skipped, 0);
  const failed = results.filter((r) => !r.ok);
  const hasFailures = failed.length > 0;
  const summaryParts: string[] = [];
  summaryParts.push(`${totalCreated} new`);
  if (totalUpdated > 0) summaryParts.push(`${totalUpdated} updated`);
  if (totalSkipped > 0) summaryParts.push(`${totalSkipped} skipped`);
  return (
    <div
      className={cn(
        "mb-5 animate-fade-in rounded-2xl border px-4 py-3 text-sm",
        hasFailures
          ? "border-rose-500/30 bg-rose-500/5 text-rose-600"
          : "border-emerald-500/30 bg-emerald-500/5",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          {hasFailures ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          )}
          <div>
            <div className="font-semibold">{summaryParts.join(" · ")}</div>
            {hasFailures && (
              <ul className="mt-1 space-y-0.5 text-xs">
                {failed.map((f) => (
                  <li key={f.propertyName}>
                    <span className="font-semibold">{f.propertyName}:</span>{" "}
                    {f.error ?? "unknown error"}
                  </li>
                ))}
              </ul>
            )}
            {!hasFailures && totalCreated === 0 && totalUpdated === 0 && (
              <div className="mt-0.5 text-xs text-[var(--color-muted)]">
                The iCal feed had no bookings to import (all blocked/skipped, or
                feed is empty).
              </div>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
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
  const router = useRouter();
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
                      startDelete(async () => {
                        await deleteExpenseAction(e.id);
                        router.refresh();
                      });
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
          key={editing === undefined ? "closed" : editing?.id ?? "new"}
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
  const router = useRouter();
  const [state, action, pending] = useActionState<
    ExpenseState | undefined,
    FormData
  >(upsertExpenseAction, undefined);
  const [type, setType] = useState<string>(expense?.type ?? "OTHERS");

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
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-11 w-full rounded-xl border-2 border-[var(--color-border)] bg-white px-3 text-sm font-medium transition-colors hover:border-[#cbd5d3] focus:border-[var(--color-brand)] focus:outline-none focus:ring-[3px] focus:ring-[var(--color-brand)]/25"
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
        <Field
          label={labels.description}
          htmlFor="description"
          hint={
            type === "OTHERS"
              ? "Required — describe the expense"
              : "Optional"
          }
        >
          <Textarea
            id="description"
            name="description"
            required={type === "OTHERS"}
            defaultValue={expense?.description ?? ""}
            placeholder="Paid Outstanding DEWA Bill"
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

// 12-month "Bill into" picker (current ± 6, default current). Submits
// the selected "YYYY-MM" key the action persists into `monthKey`.
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

function PropertyPaymentsDrawer({
  open,
  property,
  payments,
  locale,
  labels,
  onClose,
}: {
  open: boolean;
  property: Property | null;
  payments: PaymentEntry[];
  locale: Locale;
  labels: Labels;
  onClose: () => void;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [deletePending, startDelete] = useTransition();
  const total = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <Sheet
      open={open && !!property}
      onClose={onClose}
      side="right"
      title={property?.name}
      description={labels.recordPayment ?? "Record payment"}
    >
      <div className="flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            {labels.totalPaid ?? "Total paid"} · {payments.length}
          </div>
          <div className="mt-0.5 text-xl font-bold text-emerald-700">
            {formatCurrency(total, "AED", locale)}
          </div>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          {labels.recordPayment ?? "Record payment"}
        </Button>
      </div>

      {payments.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-[var(--color-border)] bg-white px-4 py-10 text-center text-sm text-[var(--color-muted)]">
          {labels.noPayments ?? "No payments recorded yet."}
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {payments.map((p) => (
            <li
              key={p.id}
              className="flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[10px] text-[var(--color-muted)]">
                  <span>{formatDate(p.date, locale)}</span>
                  {p.method && (
                    <span className="rounded-full bg-[var(--color-surface-2)] px-1.5 py-0.5 font-semibold uppercase tracking-wider">
                      {p.method}
                    </span>
                  )}
                  {p.reference && (
                    <span className="truncate">· {p.reference}</span>
                  )}
                </div>
                {p.notes && (
                  <div className="mt-1 line-clamp-2 text-xs text-[var(--color-muted)]">
                    {p.notes}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-emerald-700 tabular-nums">
                  + {formatCurrency(p.amount, "AED", locale)}
                </div>
                <button
                  disabled={deletePending}
                  onClick={() => {
                    if (
                      !confirm(
                        labels.deletePaymentConfirm ??
                          "Delete this payment? This cannot be undone.",
                      )
                    )
                      return;
                    startDelete(async () => {
                      await deleteOwnerPaymentAction(p.id);
                      router.refresh();
                    });
                  }}
                  aria-label="Delete"
                  className="mt-1 rounded-lg p-1 text-[var(--color-muted)] hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {property && (
        <PaymentEditor
          key={creating ? "open" : "closed"}
          open={creating}
          ownerId={property.ownerId}
          propertyId={property.id}
          labels={labels}
          onClose={() => setCreating(false)}
        />
      )}
    </Sheet>
  );
}

function PaymentEditor({
  open,
  ownerId,
  propertyId,
  labels,
  onClose,
}: {
  open: boolean;
  ownerId: string;
  propertyId: string;
  labels: Labels;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<
    OwnerPaymentState | undefined,
    FormData
  >(createOwnerPaymentAction, undefined);

  useEffect(() => {
    if (state?.status === "ok") {
      router.refresh();
      onClose();
    }
  }, [state, onClose, router]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={labels.recordPayment ?? "Record payment"}
    >
      <form action={action} className="space-y-4">
        <input type="hidden" name="ownerId" value={ownerId} />
        <input type="hidden" name="propertyId" value={propertyId} />

        <div className="grid grid-cols-2 gap-3">
          <Field label={labels.date} htmlFor="op-date">
            <Input
              id="op-date"
              name="date"
              type="date"
              defaultValue={today}
              required
            />
          </Field>
          <Field
            label={`${labels.amount} (${labels.currency})`}
            htmlFor="op-amount"
          >
            <Input
              id="op-amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="0.00"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label={labels.paymentMethod ?? "Method"}
            htmlFor="op-method"
            hint="bank, cash, …"
          >
            <Input
              id="op-method"
              name="method"
              placeholder="bank transfer"
            />
          </Field>
          <Field
            label={labels.paymentReference ?? "Reference"}
            htmlFor="op-reference"
            hint="invoice / period"
          >
            <Input
              id="op-reference"
              name="reference"
              placeholder="Apr 2026"
            />
          </Field>
        </div>

        <Field label={labels.notes} htmlFor="op-notes">
          <Textarea
            id="op-notes"
            name="notes"
            placeholder="Anything worth remembering about this payment…"
          />
        </Field>

        {state?.status === "error" && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600">
            {state.message}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
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
