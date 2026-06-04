"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  CheckCircle2,
  XCircle,
  BedDouble,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Textarea, Field } from "@/components/ui/input";
import { PageHeader } from "@/components/app-shell";
import { cn, formatDate } from "@/lib/utils";
import {
  approveReservationRequestAction,
  rejectReservationRequestAction,
} from "@/app/actions/owner-stay";
import type { Locale } from "@/i18n/config";

type Status = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

type Entry = {
  id: string;
  status: Status;
  checkIn: string;
  checkOut: string;
  nights: number;
  notes: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  property: { id: string; name: string; color: string };
  ownerName: string;
};

const TABS: Status[] = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];

export function StayRequestsView({
  locale,
  tab,
  basePath,
  counts,
  entries,
}: {
  locale: Locale;
  tab: Status;
  basePath: string;
  counts: Record<Status, number>;
  entries: Entry[];
}) {
  const router = useRouter();
  const [decideTarget, setDecideTarget] = useState<{
    entry: Entry;
    action: "approve" | "reject";
  } | null>(null);
  const [, startNav] = useTransition();

  const goTo = (next: Status) => {
    const params = new URLSearchParams();
    if (next !== "PENDING") params.set("tab", next);
    const qs = params.toString();
    startNav(() => router.push(`${basePath}${qs ? `?${qs}` : ""}`));
  };

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <BedDouble className="h-5 w-5 text-[var(--color-brand)]" />
            Owner stay requests
          </span>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-[var(--color-border)] bg-white p-1">
          {TABS.map((k) => (
            <button
              key={k}
              onClick={() => goTo(k)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                tab === k
                  ? k === "PENDING"
                    ? "bg-amber-500 text-white"
                    : k === "APPROVED"
                      ? "bg-emerald-600 text-white"
                      : k === "REJECTED"
                        ? "bg-rose-600 text-white"
                        : "bg-slate-500 text-white"
                  : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]",
              )}
            >
              {k}
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
      </div>

      {entries.length === 0 ? (
        <Card className="grid place-items-center px-6 py-16 text-center">
          <BedDouble className="h-8 w-8 text-[var(--color-muted)]" />
          <p className="mt-3 text-sm text-[var(--color-muted)]">
            No {tab.toLowerCase()} requests.
          </p>
        </Card>
      ) : (
        <Card className="overflow-visible">
          <div className="overflow-x-auto">
            <table className="grid-table w-full text-sm">
              <thead className="bg-[var(--color-surface-2)] text-xs uppercase tracking-wider text-[var(--color-muted)]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Property</th>
                  <th className="px-4 py-3 text-left font-semibold">Owner</th>
                  <th className="px-4 py-3 text-left font-semibold">Dates</th>
                  <th className="px-4 py-3 text-right font-semibold">Nights</th>
                  <th className="px-4 py-3 text-left font-semibold">Notes</th>
                  <th className="w-32 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr
                    key={e.id}
                    className="hover:bg-[var(--color-surface-2)]/60"
                  >
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="h-5 w-1 shrink-0 rounded-full"
                          style={{ background: e.property.color }}
                        />
                        <span className="font-medium">{e.property.name}</span>
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {e.ownerName}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatDate(e.checkIn, locale)} →{" "}
                      {formatDate(e.checkOut, locale)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {e.nights}
                    </td>
                    <td className="max-w-[320px] truncate px-4 py-3">
                      {e.notes || (
                        <span className="text-[var(--color-muted)]">—</span>
                      )}
                      {e.decisionNote && (
                        <div className="mt-0.5 truncate text-[11px] italic text-[var(--color-muted)]">
                          Decision: {e.decisionNote}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      {e.status === "PENDING" ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setDecideTarget({
                                entry: e,
                                action: "approve",
                              })
                            }
                            aria-label="Approve"
                            title="Approve"
                            className="grid h-8 w-8 place-items-center rounded-lg text-emerald-700 hover:bg-emerald-500/10"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDecideTarget({
                                entry: e,
                                action: "reject",
                              })
                            }
                            aria-label="Reject"
                            title="Reject"
                            className="grid h-8 w-8 place-items-center rounded-lg text-rose-600 hover:bg-rose-500/10"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="text-right text-[11px] text-[var(--color-muted)]">
                          {e.decidedAt
                            ? formatDate(e.decidedAt, locale)
                            : ""}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <DecideEditor
        key={decideTarget ? decideTarget.entry.id + decideTarget.action : "closed"}
        open={!!decideTarget}
        target={decideTarget}
        onClose={() => setDecideTarget(null)}
      />
    </div>
  );
}

function DecideEditor({
  open,
  target,
  onClose,
}: {
  open: boolean;
  target: { entry: Entry; action: "approve" | "reject" } | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTx] = useTransition();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (!target) return null;
  const isApprove = target.action === "approve";

  const handle = () => {
    setError(null);
    startTx(async () => {
      try {
        if (isApprove) {
          await approveReservationRequestAction({
            requestId: target.entry.id,
            note,
          });
        } else {
          await rejectReservationRequestAction({
            requestId: target.entry.id,
            note,
          });
        }
        router.refresh();
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isApprove ? "Approve request" : "Reject request"}
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 px-3 py-2.5 text-sm">
          <Clock className="mr-1 inline h-4 w-4 align-middle" />
          {target.entry.property.name} ·{" "}
          {target.entry.checkIn.slice(0, 10)} →{" "}
          {target.entry.checkOut.slice(0, 10)} ({target.entry.nights}n)
        </div>
        <Field label="Note (optional)" htmlFor="decide-note">
          <Textarea
            id="decide-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              isApprove
                ? "Internal confirmation, key handover, etc."
                : "Reason — shown to the owner"
            }
          />
        </Field>
        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handle}
            loading={pending}
            className={isApprove ? "" : "!bg-rose-600 hover:!bg-rose-700"}
          >
            {isApprove ? "Approve" : "Reject"}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
