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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Field, Textarea } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { PageHeader } from "@/components/app-shell";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  upsertInvestmentAction,
  deleteInvestmentAction,
  type InvestmentState,
} from "@/app/actions/investments";
import type { Locale } from "@/i18n/config";

export type Entry = {
  id: string;
  amount: number;
  source: string;
  description: string | null;
  date: string;
};

export function InvestmentsView({
  locale,
  basePath,
  page,
  totalPages,
  totalCount,
  totalAmount,
  entries,
}: {
  locale: Locale;
  basePath: string;
  page: number;
  totalPages: number;
  totalCount: number;
  totalAmount: number;
  entries: Entry[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Entry | null | undefined>(undefined);
  const [deletePending, startDelete] = useTransition();
  const [, startNav] = useTransition();

  const goTo = (nextPage: number) => {
    const params = new URLSearchParams();
    if (nextPage > 1) params.set("page", String(nextPage));
    const qs = params.toString();
    startNav(() => {
      router.push(`${basePath}${qs ? `?${qs}` : ""}`);
    });
  };

  return (
    <div>
      <PageHeader title="Investments" />

      {/* Summary band — info only, never used in any calculation. */}
      <div className="mb-4 flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-5 py-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            Total invested
          </div>
          <div className="mt-0.5 text-xs text-emerald-700/70">
            {totalCount} {totalCount === 1 ? "entry" : "entries"}
          </div>
        </div>
        <div className="text-2xl font-bold tabular-nums text-emerald-700">
          {formatCurrency(totalAmount, "AED", locale)}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
        <Button onClick={() => setEditing(null)}>
          <Plus className="h-4 w-4" />
          Add investment
        </Button>
      </div>

      {entries.length === 0 ? (
        <Card className="grid place-items-center px-6 py-16 text-center">
          <Banknote className="h-8 w-8 text-[var(--color-muted)]" />
          <p className="mt-3 text-sm text-[var(--color-muted)]">
            No investments recorded yet.
          </p>
        </Card>
      ) : (
        <Card className="overflow-visible">
          <div className="overflow-x-auto">
            <table className="grid-table w-full text-sm">
              <thead className="bg-[var(--color-surface-2)] text-xs uppercase tracking-wider text-[var(--color-muted)]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Source</th>
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
                    <td className="px-4 py-3 font-medium">{e.source}</td>
                    <td className="max-w-[420px] truncate px-4 py-3">
                      {e.description || (
                        <span className="text-[var(--color-muted)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-emerald-700">
                      {formatCurrency(e.amount, "AED", locale)}
                    </td>
                    <td className="px-2 py-3">
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
                            if (confirm("Delete this investment entry?")) {
                              startDelete(async () => {
                                await deleteInvestmentAction(e.id);
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

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm">
          <button
            disabled={page <= 1}
            onClick={() => goTo(page - 1)}
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
            onClick={() => goTo(page + 1)}
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
        entry={editing ?? null}
        onClose={() => setEditing(undefined)}
      />
    </div>
  );
}

function InvestmentEditor({
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
    InvestmentState | undefined,
    FormData
  >(upsertInvestmentAction, undefined);

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
      title={entry ? "Edit investment" : "Add investment"}
    >
      <form action={action} className="space-y-4">
        {entry && <input type="hidden" name="id" value={entry.id} />}
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
          label="Source"
          htmlFor="inv-source"
          hint="Who or where the money came from"
        >
          <Input
            id="inv-source"
            name="source"
            type="text"
            required
            maxLength={255}
            defaultValue={entry?.source ?? ""}
            placeholder="Founder injection / Partner X / Bank loan"
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
