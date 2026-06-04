"use client";

// Owner-facing stay-request flow. The page is the owner's home for
// "I want to spend X nights in my own apartment". Lists quota status
// per property + a request submission Sheet + history of past
// requests with their admin decisions.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BedDouble,
  CalendarRange,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Field, Textarea } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { PageHeader } from "@/components/app-shell";
import { FadeIn } from "@/components/ui/motion";
import { EmptyState } from "@/components/owner/empty-state";
import { cn, formatDate } from "@/lib/utils";
import {
  createOwnerReservationRequestAction,
  cancelOwnerReservationRequestAction,
} from "@/app/actions/owner-stay";
import type { Locale } from "@/i18n/config";

type Status = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

type PropertyOption = {
  id: string;
  name: string;
  color: string;
  hasQuota: boolean;
  quota: {
    daysPerYear: number;
    usedNights: number;
    pendingNights: number;
    remainingNights: number;
    cycleStart: string;
    cycleEnd: string;
  } | null;
};

type Request = {
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
};

export function OwnerStayRequestsView({
  locale,
  properties,
  requests,
}: {
  locale: Locale;
  properties: PropertyOption[];
  requests: Request[];
}) {
  const router = useRouter();
  const [requestOpen, setRequestOpen] = useState<{ propertyId: string } | null>(
    null,
  );
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [pending, startTx] = useTransition();

  const propsWithQuota = properties.filter((p) => p.hasQuota);

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <BedDouble className="h-5 w-5 text-[var(--color-brand)]" />
            Stay requests
          </span>
        }
      />

      {propsWithQuota.length === 0 ? (
        <EmptyState
          title="No stay quota yet"
          description="Reach out to management to set one up — once a property has a quota, you can request your own stays from here."
          illustration="/illustrations/owner-stay-empty.svg"
          icon={<BedDouble className="h-7 w-7" />}
        />
      ) : (
        <div className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {propsWithQuota.map((p) => (
            <Card key={p.id}>
              <CardBody className="space-y-3">
                <div className="flex items-center gap-2">
                  <span
                    className="h-5 w-1.5 shrink-0 rounded-full"
                    style={{ background: p.color }}
                  />
                  <span className="font-semibold">{p.name}</span>
                </div>
                {p.quota && (
                  <>
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-2xl font-bold tabular-nums text-emerald-700">
                          {p.quota.remainingNights}
                        </div>
                        <div className="text-[11px] uppercase tracking-wider text-[var(--color-muted)]">
                          nights remaining
                        </div>
                      </div>
                      <div className="text-right text-[11px] text-[var(--color-muted)]">
                        {p.quota.usedNights} used
                        {p.quota.pendingNights > 0 && (
                          <>
                            <br />
                            {p.quota.pendingNights} pending
                          </>
                        )}
                        <br />
                        of {p.quota.daysPerYear}
                      </div>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                      <div className="flex h-full">
                        <div
                          className="h-full bg-emerald-500"
                          style={{
                            width: `${Math.min(100, (p.quota.usedNights / Math.max(1, p.quota.daysPerYear)) * 100)}%`,
                          }}
                        />
                        <div
                          className="h-full bg-amber-400"
                          style={{
                            width: `${Math.min(100, (p.quota.pendingNights / Math.max(1, p.quota.daysPerYear)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="text-[11px] text-[var(--color-muted)]">
                      Cycle {formatDate(p.quota.cycleStart, locale)} →{" "}
                      {formatDate(p.quota.cycleEnd, locale)}
                    </div>
                    <Button
                      onClick={() => setRequestOpen({ propertyId: p.id })}
                      disabled={p.quota.remainingNights <= 0}
                    >
                      <Plus className="h-4 w-4" />
                      Request stay
                    </Button>
                  </>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Your requests
        </h2>
        {requests.length === 0 ? (
          <Card className="grid place-items-center px-6 py-10 text-center">
            <CalendarRange className="h-7 w-7 text-[var(--color-muted)]" />
            <p className="mt-2 text-xs text-[var(--color-muted)]">
              No requests yet.
            </p>
          </Card>
        ) : (
          <ul className="space-y-2">
            {requests.map((r) => (
              <li
                key={r.id}
                className="flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-white p-3"
              >
                <span
                  className="mt-1 h-5 w-1.5 shrink-0 rounded-full"
                  style={{ background: r.property.color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={r.status} />
                    <span className="text-sm font-semibold">
                      {r.property.name}
                    </span>
                    <span className="text-xs text-[var(--color-muted)]">
                      {formatDate(r.checkIn, locale)} →{" "}
                      {formatDate(r.checkOut, locale)} ({r.nights}n)
                    </span>
                  </div>
                  {r.notes && (
                    <div className="mt-1 text-xs text-[var(--color-foreground)]/80">
                      “{r.notes}”
                    </div>
                  )}
                  {r.decisionNote && (
                    <div className="mt-1 text-xs italic text-[var(--color-muted)]">
                      Management: {r.decisionNote}
                    </div>
                  )}
                </div>
                {r.status === "PENDING" && (
                  <button
                    type="button"
                    disabled={pending && cancellingId === r.id}
                    onClick={() => {
                      if (!confirm("Cancel this request?")) return;
                      setCancellingId(r.id);
                      startTx(async () => {
                        try {
                          await cancelOwnerReservationRequestAction(r.id);
                          router.refresh();
                        } finally {
                          setCancellingId(null);
                        }
                      });
                    }}
                    className="text-xs font-medium text-rose-600 hover:underline disabled:opacity-40"
                  >
                    Cancel
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <RequestEditor
        key={requestOpen?.propertyId ?? "closed"}
        open={!!requestOpen}
        propertyId={requestOpen?.propertyId ?? ""}
        properties={propsWithQuota}
        onClose={() => setRequestOpen(null)}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const tone: Record<Status, string> = {
    PENDING: "bg-amber-500/15 text-amber-700",
    APPROVED: "bg-emerald-500/15 text-emerald-700",
    REJECTED: "bg-rose-500/15 text-rose-700",
    CANCELLED: "bg-slate-500/15 text-slate-700",
  };
  const Icon: Record<Status, React.ReactNode> = {
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

function RequestEditor({
  open,
  propertyId,
  properties,
  onClose,
}: {
  open: boolean;
  propertyId: string;
  properties: PropertyOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTx] = useTransition();
  const [selectedProp, setSelectedProp] = useState(propertyId);
  const [checkIn, setCheckIn] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [checkOut, setCheckOut] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    startTx(async () => {
      try {
        await createOwnerReservationRequestAction({
          propertyId: selectedProp,
          checkIn: new Date(checkIn).toISOString(),
          checkOut: new Date(checkOut).toISOString(),
          notes,
        });
        router.refresh();
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  };

  const sel = properties.find((p) => p.id === selectedProp);
  const remaining = sel?.quota?.remainingNights ?? 0;

  return (
    <Sheet open={open} onClose={onClose} title="Request stay">
      <div className="space-y-4">
        <Field label="Property" htmlFor="req-property">
          <select
            id="req-property"
            value={selectedProp}
            onChange={(e) => setSelectedProp(e.target.value)}
            className="h-11 w-full rounded-xl border-2 border-[var(--color-border)] bg-white px-3 text-sm font-medium"
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        {sel?.quota && (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 px-3 py-2 text-xs text-[var(--color-muted)]">
            <span className="font-semibold text-emerald-700">{remaining}</span>{" "}
            of {sel.quota.daysPerYear} nights remaining this cycle.
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Check-in" htmlFor="req-ci">
            <Input
              id="req-ci"
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
            />
          </Field>
          <Field label="Check-out" htmlFor="req-co">
            <Input
              id="req-co"
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              min={checkIn}
            />
          </Field>
        </div>
        <Field
          label="Notes"
          htmlFor="req-notes"
          hint="Optional — guests joining you, any special requests…"
        >
          <Textarea
            id="req-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
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
          <Button onClick={submit} loading={pending}>
            Submit
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
