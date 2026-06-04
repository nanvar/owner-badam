"use client";

// Admin-side quota config + incoming-request list. Lives on the
// property detail page so admins see the cap, the rolling usage, and
// any pending owner requests in one card.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BedDouble,
  CalendarRange,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Field, Textarea } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { cn, formatDate } from "@/lib/utils";
import {
  upsertOwnerStayQuotaAction,
  deleteOwnerStayQuotaAction,
  approveReservationRequestAction,
  rejectReservationRequestAction,
} from "@/app/actions/owner-stay";
import type { Locale } from "@/i18n/config";

export type Quota = {
  daysPerYear: number;
  yearStartMonth: number;
  yearStartDay: number;
  usedNights: number;
  pendingNights: number;
  remainingNights: number;
  cycleStart: string;
  cycleEnd: string;
} | null;

export type StayRequest = {
  id: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  notes: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  ownerName: string;
};

export function StayQuotaCard({
  propertyId,
  locale,
  quota,
  requests,
}: {
  propertyId: string;
  locale: Locale;
  quota: Quota;
  requests: StayRequest[];
}) {
  const router = useRouter();
  const [pending, startTx] = useTransition();
  const [configOpen, setConfigOpen] = useState(false);
  const [decideTarget, setDecideTarget] = useState<{
    request: StayRequest;
    action: "approve" | "reject";
  } | null>(null);

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              <BedDouble className="h-4 w-4" />
              Owner stay quota
            </div>
            {quota ? (
              <div className="mt-1 text-xs text-[var(--color-muted)]">
                {quota.daysPerYear} nights / year · cycle{" "}
                {formatDate(quota.cycleStart, locale)} →{" "}
                {formatDate(quota.cycleEnd, locale)}
              </div>
            ) : (
              <div className="mt-1 text-xs text-[var(--color-muted)]">
                No quota set. Owner can&apos;t submit stay requests yet.
              </div>
            )}
          </div>
          <Button onClick={() => setConfigOpen(true)} variant="secondary">
            {quota ? "Edit" : "Set up"}
          </Button>
        </div>

        {quota && (
          <div className="rounded-2xl border border-[var(--color-border)] bg-white p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[var(--color-muted)]">
                Usage this cycle
              </span>
              <span className="tabular-nums">
                <span className="font-semibold text-emerald-700">
                  {quota.usedNights}
                </span>
                {quota.pendingNights > 0 && (
                  <>
                    {" · "}
                    <span className="text-amber-700">
                      {quota.pendingNights} pending
                    </span>
                  </>
                )}
                {" / "}
                {quota.daysPerYear} nights
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
              <div className="flex h-full">
                <div
                  className="h-full bg-emerald-500"
                  style={{
                    width: `${Math.min(100, (quota.usedNights / Math.max(1, quota.daysPerYear)) * 100)}%`,
                  }}
                />
                <div
                  className="h-full bg-amber-400"
                  style={{
                    width: `${Math.min(100, (quota.pendingNights / Math.max(1, quota.daysPerYear)) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <div className="mt-1 text-[11px] text-[var(--color-muted)]">
              {quota.remainingNights} night
              {quota.remainingNights === 1 ? "" : "s"} remaining
            </div>
          </div>
        )}

        {requests.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-xs text-[var(--color-muted)]">
            No stay requests yet.
          </p>
        ) : (
          <div className="space-y-2">
            {pendingCount > 0 && (
              <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                {pendingCount} pending
              </div>
            )}
            <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] bg-white">
              {requests.map((r) => (
                <li key={r.id} className="px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={r.status} />
                        <span className="text-sm font-medium">
                          {formatDate(r.checkIn, locale)} →{" "}
                          {formatDate(r.checkOut, locale)} ({r.nights}n)
                        </span>
                      </div>
                      <div className="text-[11px] text-[var(--color-muted)]">
                        Filed {formatDate(r.createdAt, locale)} · by {r.ownerName}
                      </div>
                      {r.notes && (
                        <div className="mt-1 line-clamp-2 text-xs text-[var(--color-foreground)]/80">
                          “{r.notes}”
                        </div>
                      )}
                      {r.decisionNote && (
                        <div className="mt-1 line-clamp-2 text-xs italic text-[var(--color-muted)]">
                          Decision: {r.decisionNote}
                        </div>
                      )}
                    </div>
                    {r.status === "PENDING" && (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            setDecideTarget({ request: r, action: "approve" })
                          }
                          aria-label="Approve"
                          title="Approve"
                          className="grid h-8 w-8 place-items-center rounded-lg text-emerald-700 hover:bg-emerald-500/10 disabled:opacity-40"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            setDecideTarget({ request: r, action: "reject" })
                          }
                          aria-label="Reject"
                          title="Reject"
                          className="grid h-8 w-8 place-items-center rounded-lg text-rose-600 hover:bg-rose-500/10 disabled:opacity-40"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardBody>

      <QuotaEditor
        key={configOpen ? "qopen" : "qclosed"}
        open={configOpen}
        propertyId={propertyId}
        initial={quota}
        onClose={() => setConfigOpen(false)}
        startTx={startTx}
      />

      <DecideRequestEditor
        key={decideTarget ? decideTarget.request.id + decideTarget.action : "dclosed"}
        open={!!decideTarget}
        target={decideTarget}
        onClose={() => setDecideTarget(null)}
      />
    </Card>
  );
}

function StatusBadge({ status }: { status: StayRequest["status"] }) {
  const tone: Record<StayRequest["status"], string> = {
    PENDING: "bg-amber-500/15 text-amber-700",
    APPROVED: "bg-emerald-500/15 text-emerald-700",
    REJECTED: "bg-rose-500/15 text-rose-700",
    CANCELLED: "bg-slate-500/15 text-slate-700",
  };
  const Icon: Record<StayRequest["status"], React.ReactNode> = {
    PENDING: <Clock className="h-3 w-3" />,
    APPROVED: <CheckCircle2 className="h-3 w-3" />,
    REJECTED: <XCircle className="h-3 w-3" />,
    CANCELLED: <XCircle className="h-3 w-3" />,
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        tone[status],
      )}
    >
      {Icon[status]}
      {status}
    </span>
  );
}

function QuotaEditor({
  open,
  initial,
  propertyId,
  onClose,
  startTx,
}: {
  open: boolean;
  initial: Quota;
  propertyId: string;
  onClose: () => void;
  startTx: (cb: () => void) => void;
}) {
  const router = useRouter();
  const [daysPerYear, setDaysPerYear] = useState<number>(
    initial?.daysPerYear ?? 30,
  );
  const [yearStartMonth, setYearStartMonth] = useState<number>(
    initial?.yearStartMonth ?? 1,
  );
  const [yearStartDay, setYearStartDay] = useState<number>(
    initial?.yearStartDay ?? 1,
  );
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    setError(null);
    startTx(async () => {
      try {
        await upsertOwnerStayQuotaAction({
          propertyId,
          daysPerYear,
          yearStartMonth,
          yearStartDay,
        });
        router.refresh();
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  };

  const handleDelete = () => {
    if (!confirm("Delete the quota? Owner won't be able to file new requests.")) return;
    startTx(async () => {
      try {
        await deleteOwnerStayQuotaAction(propertyId);
        router.refresh();
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  };

  return (
    <Sheet open={open} onClose={onClose} title="Owner stay quota">
      <div className="space-y-4">
        <Field label="Days per year" htmlFor="quota-days" hint="0 disables the feature">
          <Input
            id="quota-days"
            type="number"
            min={0}
            max={366}
            value={daysPerYear}
            onChange={(e) => setDaysPerYear(parseInt(e.target.value, 10) || 0)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cycle start month" htmlFor="quota-start-month">
            <Input
              id="quota-start-month"
              type="number"
              min={1}
              max={12}
              value={yearStartMonth}
              onChange={(e) => setYearStartMonth(parseInt(e.target.value, 10) || 1)}
            />
          </Field>
          <Field label="Cycle start day" htmlFor="quota-start-day">
            <Input
              id="quota-start-day"
              type="number"
              min={1}
              max={31}
              value={yearStartDay}
              onChange={(e) => setYearStartDay(parseInt(e.target.value, 10) || 1)}
            />
          </Field>
        </div>
        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600">
            {error}
          </div>
        )}
        <div className="flex items-center justify-between pt-2">
          {initial ? (
            <Button variant="ghost" onClick={handleDelete} className="text-rose-600">
              Delete quota
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function DecideRequestEditor({
  open,
  target,
  onClose,
}: {
  open: boolean;
  target: { request: StayRequest; action: "approve" | "reject" } | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [note, setNote] = useState<string>("");
  const [pending, startTx] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!target) return null;
  const isApprove = target.action === "approve";

  const handleConfirm = () => {
    setError(null);
    startTx(async () => {
      try {
        if (isApprove) {
          await approveReservationRequestAction({
            requestId: target.request.id,
            note,
          });
        } else {
          await rejectReservationRequestAction({
            requestId: target.request.id,
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
          <CalendarRange className="mr-1 inline h-4 w-4 align-middle" />
          {target.request.checkIn.slice(0, 10)} →{" "}
          {target.request.checkOut.slice(0, 10)} ({target.request.nights}n)
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
            onClick={handleConfirm}
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
