"use client";

import { useActionState, useState, useTransition } from "react";
import {
  Plus,
  RefreshCw,
  Edit3,
  Trash2,
  Building2,
  Calendar as CalendarIcon,
  Link as LinkIcon,
  CheckCircle2,
  AlertTriangle,
  Coins,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input, Field, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { PageHeader } from "@/components/app-shell";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  upsertPropertyAction,
  deletePropertyAction,
  type PropertyState,
} from "@/app/actions/properties";
import { syncAllAction, syncOneAction, type SyncState } from "@/app/actions/sync";
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

type Labels = Record<string, string>;

export function PropertiesView({
  locale,
  properties,
  owners,
  labels,
}: {
  locale: Locale;
  properties: Property[];
  owners: Owner[];
  labels: Labels;
}) {
  const [editing, setEditing] = useState<Property | null | undefined>(undefined);
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [syncPending, startSync] = useTransition();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deletePending, startDelete] = useTransition();

  return (
    <div>
      <PageHeader
        title={labels.title}
        right={
          <>
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
            <Button onClick={() => setEditing(null)}>
              <Plus className="h-4 w-4" />
              {labels.addProperty}
            </Button>
          </>
        }
      />

      {syncState && syncState.status === "ok" && (
        <SyncSummary
          results={syncState.results}
          onClose={() => setSyncState(null)}
        />
      )}
      {syncState && syncState.status === "error" && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600">
          <AlertTriangle className="h-4 w-4" />
          {syncState.message}
        </div>
      )}

      {properties.length === 0 ? (
        <EmptyState label={labels.noProperties} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface-2)] text-xs uppercase tracking-wider text-[var(--color-muted)]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">{labels.name}</th>
                  <th className="px-4 py-3 text-left font-semibold">{labels.owner}</th>
                  <th className="px-4 py-3 text-left font-semibold">iCal</th>
                  <th className="px-4 py-3 text-right font-semibold">{labels.basePrice}</th>
                  <th className="px-4 py-3 text-right font-semibold">{labels.cleaningFee}</th>
                  <th className="px-4 py-3 text-right font-semibold">
                    <CalendarIcon className="-mt-0.5 mr-1 inline h-3.5 w-3.5" />
                    {labels.reservations ?? "Res."}
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">{labels.lastSynced}</th>
                  <th className="px-4 py-3 text-right font-semibold">{labels.actions ?? ""}</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((p) => (
                  <PropertyRow
                    key={p.id}
                    property={p}
                    labels={labels}
                    locale={locale}
                    onEdit={() => setEditing(p)}
                    onDelete={() => setDeleteId(p.id)}
                    onSync={async () => {
                      const r = await syncOneAction(p.id);
                      setSyncState(r);
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <PropertyEditor
        open={editing !== undefined}
        property={editing ?? null}
        owners={owners}
        labels={labels}
        onClose={() => setEditing(undefined)}
      />

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

function PropertyRow({
  property,
  labels,
  locale,
  onEdit,
  onDelete,
  onSync,
}: {
  property: Property;
  labels: Labels;
  locale: Locale;
  onEdit: () => void;
  onDelete: () => void;
  onSync: () => Promise<void>;
}) {
  const [pending, start] = useTransition();
  return (
    <tr className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]/60">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span
            className="h-8 w-1 shrink-0 rounded-full"
            style={{ background: property.color }}
          />
          <div className="min-w-0">
            <div className="truncate font-semibold text-[var(--color-foreground)]">
              {property.name}
            </div>
            {property.address && (
              <div className="truncate text-xs text-[var(--color-muted)]">
                {property.address}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge tone="brand">
          <Building2 className="h-3 w-3" />
          {property.ownerName}
        </Badge>
      </td>
      <td className="px-4 py-3">
        {property.airbnbIcalUrl ? (
          <Badge tone="success">
            <LinkIcon className="h-3 w-3" /> set
          </Badge>
        ) : (
          <Badge tone="warning">missing</Badge>
        )}
      </td>
      <td className="px-4 py-3 text-right font-semibold">
        {formatCurrency(property.basePrice, "AED", locale)}
      </td>
      <td className="px-4 py-3 text-right">
        {formatCurrency(property.cleaningFee, "AED", locale)}
      </td>
      <td className="px-4 py-3 text-right">{property.reservationCount}</td>
      <td className="px-4 py-3 text-xs text-[var(--color-muted)] whitespace-nowrap">
        {property.lastSyncedAt
          ? formatDate(property.lastSyncedAt, locale)
          : labels.never}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
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
      </td>
    </tr>
  );
}

function PropertyEditor({
  open,
  property,
  owners,
  labels,
  onClose,
}: {
  open: boolean;
  property: Property | null;
  owners: Owner[];
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
        <div className="grid grid-cols-2 gap-3">
          <Field label={`${labels.basePrice} (${labels.currency})`} htmlFor="basePrice">
            <Input
              id="basePrice"
              name="basePrice"
              type="number"
              min="0"
              step="0.01"
              defaultValue={property?.basePrice ?? 0}
            />
          </Field>
          <Field label={`${labels.cleaningFee} (${labels.currency})`} htmlFor="cleaningFee">
            <Input
              id="cleaningFee"
              name="cleaningFee"
              type="number"
              min="0"
              step="0.01"
              defaultValue={property?.cleaningFee ?? 0}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={labels.owner} htmlFor="ownerId">
            <select
              id="ownerId"
              name="ownerId"
              required
              defaultValue={property?.ownerId ?? owners[0]?.id ?? ""}
              className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-white px-3.5 text-sm"
            >
              {owners.length === 0 && <option value="">— no owners yet —</option>}
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name ?? o.email}
                </option>
              ))}
            </select>
          </Field>
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

function SyncSummary({ results, onClose }: { results: { propertyName: string; ok: boolean; created: number; updated: number; skipped: number; error?: string }[]; onClose: () => void }) {
  const totalCreated = results.reduce((s, r) => s + r.created, 0);
  const totalUpdated = results.reduce((s, r) => s + r.updated, 0);
  const failed = results.filter((r) => !r.ok);
  return (
    <div className="mb-5 animate-fade-in rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
          <div>
            <div className="text-sm font-semibold">
              <Coins className="-mt-0.5 mr-1 inline h-4 w-4 text-emerald-500" />
              {totalCreated} new · {totalUpdated} updated
            </div>
            <div className="mt-2 grid gap-1 text-xs">
              {results.map((r) => (
                <div
                  key={r.propertyName}
                  className={`flex items-center gap-2 ${r.ok ? "text-[var(--color-muted)]" : "text-rose-500"}`}
                >
                  {r.ok ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="h-3 w-3" />
                  )}
                  <span className="font-medium text-[var(--color-foreground)]">
                    {r.propertyName}
                  </span>
                  {r.ok ? (
                    <span>
                      +{r.created} · ~{r.updated} · skip {r.skipped}
                    </span>
                  ) : (
                    <span>{r.error}</span>
                  )}
                </div>
              ))}
              {failed.length > 0 && (
                <div className="mt-1 text-rose-500">
                  {failed.length} property/properties failed
                </div>
              )}
            </div>
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
