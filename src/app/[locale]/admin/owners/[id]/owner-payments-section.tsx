"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input, Field, Textarea } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  createOwnerPaymentAction,
  deleteOwnerPaymentAction,
  type OwnerPaymentState,
} from "@/app/actions/owner-payments";
import type { Locale } from "@/i18n/config";

export type OwnerPaymentItem = {
  id: string;
  date: string;
  amount: number;
  method: string | null;
  reference: string | null;
  notes: string | null;
  recordedByName: string | null;
  createdAt: string;
};

export function OwnerPaymentsSection({
  ownerId,
  ownerName,
  payments,
  locale,
}: {
  ownerId: string;
  ownerName: string;
  payments: OwnerPaymentItem[];
  locale: Locale;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [deletePending, startDelete] = useTransition();

  const total = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="mt-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <Wallet className="h-4 w-4 text-[var(--color-brand)]" />
          Payments to owner
          <span className="text-xs font-normal text-[var(--color-muted)]">
            · total {formatCurrency(total, "AED", locale)}
          </span>
        </h2>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          Record payment
        </Button>
      </div>

      {payments.length === 0 ? (
        <Card>
          <CardBody className="py-10 text-center text-sm text-[var(--color-muted)]">
            No payments recorded yet for {ownerName}.
          </CardBody>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface-2)] text-xs uppercase tracking-wider text-[var(--color-muted)]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  <th className="px-4 py-3 text-left font-semibold">Method</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Reference
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Recorded by
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Notes</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t border-[var(--color-border)]"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDate(p.date, locale)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-emerald-700">
                      {formatCurrency(p.amount, "AED", locale)}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">
                      {p.method ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">
                      {p.reference ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-muted)]">
                      {p.recordedByName ?? "—"}
                      <span className="ml-1 opacity-60">
                        {formatDate(p.createdAt, locale)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-muted)]">
                      {p.notes ? (
                        <span className="line-clamp-2">{p.notes}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() =>
                          startDelete(async () => {
                            if (
                              !confirm(
                                "Delete this payment record? This cannot be undone.",
                              )
                            )
                              return;
                            await deleteOwnerPaymentAction(p.id);
                            router.refresh();
                          })
                        }
                        disabled={deletePending}
                        className="text-rose-500 hover:text-rose-600 disabled:opacity-50"
                        aria-label="Delete payment"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <PaymentCreator
        key={creating ? "open" : "closed"}
        open={creating}
        ownerId={ownerId}
        onClose={() => setCreating(false)}
      />
    </div>
  );
}

function PaymentCreator({
  open,
  ownerId,
  onClose,
}: {
  open: boolean;
  ownerId: string;
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
      title="Record payment to owner"
      description="Logged in the settlement history with your name and timestamp."
    >
      <form action={action} className="space-y-4">
        <input type="hidden" name="ownerId" value={ownerId} />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" htmlFor="op-date">
            <Input
              id="op-date"
              name="date"
              type="date"
              defaultValue={today}
              required
            />
          </Field>
          <Field label="Amount (AED)" htmlFor="op-amount">
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
          <Field label="Method" htmlFor="op-method" hint="e.g. bank, cash">
            <Input id="op-method" name="method" placeholder="bank transfer" />
          </Field>
          <Field
            label="Reference"
            htmlFor="op-reference"
            hint="invoice / period"
          >
            <Input id="op-reference" name="reference" placeholder="Apr 2026" />
          </Field>
        </div>

        <Field label="Notes" htmlFor="op-notes">
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
