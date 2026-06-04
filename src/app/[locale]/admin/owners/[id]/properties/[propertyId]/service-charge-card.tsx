"use client";

// Per-property service-charge admin card. Lives on the property
// detail page beneath the media tabs. Two halves:
//   - Schedule (cadence + start date) — enable / edit / disable
//   - Instances list (UPCOMING / REMINDING / PAID / SKIPPED) with
//     "Mark paid + upload proof" flow.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  RotateCcw,
  Upload,
} from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Field, Textarea } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { S3Uploader, type UploadedFile } from "@/components/ui/s3-uploader";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  upsertServiceChargeScheduleAction,
  deleteServiceChargeScheduleAction,
  markServiceChargePaidAction,
  markServiceChargeUnpaidAction,
  deleteServiceChargeInstanceAction,
} from "@/app/actions/service-charge";
import type { Locale } from "@/i18n/config";

export type ServiceSchedule = {
  propertyId: string;
  frequencyMonths: number;
  reminderDaysBefore: number;
  firstDueDate: string;
  active: boolean;
} | null;

export type ServiceInstance = {
  id: string;
  dueDate: string;
  status: "UPCOMING" | "REMINDING" | "PAID" | "SKIPPED";
  paidAt: string | null;
  amount: number | null;
  notes: string | null;
  proofs: { id: string; url: string; fileName: string | null; mimeType: string | null }[];
};

export function ServiceChargeCard({
  propertyId,
  locale,
  schedule,
  instances,
}: {
  propertyId: string;
  locale: Locale;
  schedule: ServiceSchedule;
  instances: ServiceInstance[];
}) {
  const router = useRouter();
  const [pending, startTx] = useTransition();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<ServiceInstance | null>(null);

  const STATUS_TONE: Record<ServiceInstance["status"], string> = {
    UPCOMING: "bg-sky-500/15 text-sky-700",
    REMINDING: "bg-amber-500/15 text-amber-700",
    PAID: "bg-emerald-500/15 text-emerald-700",
    SKIPPED: "bg-slate-500/15 text-slate-700",
  };
  const STATUS_ICON: Record<ServiceInstance["status"], React.ReactNode> = {
    UPCOMING: <Clock className="h-3 w-3" />,
    REMINDING: <AlertCircle className="h-3 w-3" />,
    PAID: <CheckCircle2 className="h-3 w-3" />,
    SKIPPED: <Trash2 className="h-3 w-3" />,
  };

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              <CalendarClock className="h-4 w-4" />
              Service charge
            </div>
            {schedule ? (
              <div className="mt-1 text-xs text-[var(--color-muted)]">
                Every {schedule.frequencyMonths} months · reminders {schedule.reminderDaysBefore} days before · first due {formatDate(schedule.firstDueDate, locale)}
                {!schedule.active && (
                  <span className="ml-2 inline-flex rounded-full bg-slate-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700">
                    Paused
                  </span>
                )}
              </div>
            ) : (
              <div className="mt-1 text-xs text-[var(--color-muted)]">
                No schedule yet. The owner gets reminded daily once the
                window opens.
              </div>
            )}
          </div>
          <Button onClick={() => setScheduleOpen(true)} variant="secondary">
            {schedule ? "Edit" : "Set up"}
          </Button>
        </div>

        {instances.length > 0 ? (
          <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] bg-white">
            {instances.map((inst) => (
              <li key={inst.id} className="px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                          STATUS_TONE[inst.status],
                        )}
                      >
                        {STATUS_ICON[inst.status]}
                        {inst.status}
                      </span>
                      <span className="text-sm font-medium">
                        Due {formatDate(inst.dueDate, locale)}
                      </span>
                    </div>
                    {inst.status === "PAID" && inst.paidAt && (
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-muted)]">
                        <span>Paid {formatDate(inst.paidAt, locale)}</span>
                        {inst.amount != null && (
                          <span className="font-semibold text-emerald-700 tabular-nums">
                            {formatCurrency(inst.amount, "AED", locale)}
                          </span>
                        )}
                      </div>
                    )}
                    {inst.notes && (
                      <div className="mt-1 line-clamp-2 text-xs text-[var(--color-foreground)]/80">
                        {inst.notes}
                      </div>
                    )}
                    {inst.proofs.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {inst.proofs.map((p) => (
                          <a
                            key={p.id}
                            href={p.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-surface-2)] px-2 py-1 text-[11px] text-[var(--color-foreground)] hover:bg-[var(--color-brand-soft)] hover:text-[var(--color-brand)]"
                          >
                            <Upload className="h-3 w-3" />
                            {p.fileName ?? "proof"}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {inst.status !== "PAID" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setPayTarget(inst)}
                      >
                        Mark paid
                      </Button>
                    ) : (
                      <button
                        type="button"
                        disabled={pending}
                        title="Move back to upcoming"
                        onClick={() => {
                          if (!confirm("Mark this instance as unpaid?"))
                            return;
                          startTx(async () => {
                            await markServiceChargeUnpaidAction(inst.id);
                            router.refresh();
                          });
                        }}
                        className="grid h-8 w-8 place-items-center rounded-lg text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-foreground)] disabled:opacity-40"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={pending}
                      title="Delete instance"
                      onClick={() => {
                        if (!confirm("Delete this instance?")) return;
                        startTx(async () => {
                          await deleteServiceChargeInstanceAction(inst.id);
                          router.refresh();
                        });
                      }}
                      className="grid h-8 w-8 place-items-center rounded-lg text-[var(--color-muted)] hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-xs text-[var(--color-muted)]">
            No instances yet. Set up the schedule above and the first
            bill cycle will be created automatically.
          </p>
        )}
      </CardBody>

      <ScheduleEditor
        key={scheduleOpen ? "open" : "closed"}
        open={scheduleOpen}
        propertyId={propertyId}
        initial={schedule}
        onClose={() => setScheduleOpen(false)}
      />

      <PayInstanceEditor
        key={payTarget?.id ?? "pay-closed"}
        open={!!payTarget}
        instance={payTarget}
        propertyId={propertyId}
        onClose={() => setPayTarget(null)}
      />
    </Card>
  );
}

function ScheduleEditor({
  open,
  propertyId,
  initial,
  onClose,
}: {
  open: boolean;
  propertyId: string;
  initial: ServiceSchedule;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTx] = useTransition();
  const [frequencyMonths, setFrequencyMonths] = useState<number>(
    initial?.frequencyMonths ?? 3,
  );
  const [reminderDaysBefore, setReminderDaysBefore] = useState<number>(
    initial?.reminderDaysBefore ?? 7,
  );
  const [firstDueDate, setFirstDueDate] = useState<string>(
    initial?.firstDueDate
      ? initial.firstDueDate.slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  );
  const [active, setActive] = useState<boolean>(initial?.active ?? true);
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    setError(null);
    startTx(async () => {
      try {
        await upsertServiceChargeScheduleAction({
          propertyId,
          frequencyMonths,
          reminderDaysBefore,
          firstDueDate: new Date(firstDueDate).toISOString(),
          active,
        });
        router.refresh();
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  };

  const handleDelete = () => {
    if (!confirm("Disable + delete the service-charge schedule?")) return;
    startTx(async () => {
      try {
        await deleteServiceChargeScheduleAction(propertyId);
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
      title={initial ? "Edit service charge schedule" : "Set up service charge"}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Frequency (months)" htmlFor="sc-freq" hint="3 = quarterly">
            <Input
              id="sc-freq"
              type="number"
              min={1}
              max={24}
              value={frequencyMonths}
              onChange={(e) => setFrequencyMonths(parseInt(e.target.value, 10) || 1)}
            />
          </Field>
          <Field
            label="Reminder days before"
            htmlFor="sc-rdb"
            hint="Start nagging this many days in advance"
          >
            <Input
              id="sc-rdb"
              type="number"
              min={0}
              max={60}
              value={reminderDaysBefore}
              onChange={(e) => setReminderDaysBefore(parseInt(e.target.value, 10) || 0)}
            />
          </Field>
        </div>
        <Field label="First due date" htmlFor="sc-fdd">
          <Input
            id="sc-fdd"
            type="date"
            value={firstDueDate}
            onChange={(e) => setFirstDueDate(e.target.value)}
          />
        </Field>
        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[var(--color-border)] bg-white px-3 py-2.5">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-emerald-600"
          />
          <span className="flex-1">
            <span className="block text-sm font-medium">Active</span>
            <span className="block text-xs text-[var(--color-muted)]">
              When off, no reminders fire — useful for pausing without
              losing the configuration.
            </span>
          </span>
        </label>
        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600">
            {error}
          </div>
        )}
        <div className="flex items-center justify-between pt-2">
          {initial ? (
            <Button
              variant="ghost"
              onClick={handleDelete}
              disabled={pending}
              className="text-rose-600"
            >
              Delete schedule
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={pending}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function PayInstanceEditor({
  open,
  instance,
  propertyId,
  onClose,
}: {
  open: boolean;
  instance: ServiceInstance | null;
  propertyId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTx] = useTransition();
  const [amount, setAmount] = useState<string>(
    instance?.amount?.toString() ?? "",
  );
  const [notes, setNotes] = useState<string>(instance?.notes ?? "");
  const [proof, setProof] = useState<UploadedFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!instance) return null;

  const handleSave = () => {
    setError(null);
    startTx(async () => {
      try {
        await markServiceChargePaidAction({
          instanceId: instance.id,
          amount: amount ? parseFloat(amount) : undefined,
          notes,
          proofUrl: proof?.publicUrl,
          proofFileName: proof?.fileName,
          proofFileSize: proof?.fileSize,
          proofMimeType: proof?.mimeType,
        });
        router.refresh();
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  };

  return (
    <Sheet open={open} onClose={onClose} title="Mark service charge paid">
      <div className="space-y-4">
        <Field label="Amount (AED)" htmlFor="sc-amt" hint="Optional but recommended">
          <Input
            id="sc-amt"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 1850.00"
          />
        </Field>
        <Field label="Notes" htmlFor="sc-notes" hint="Reference number, payer, etc.">
          <Textarea
            id="sc-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
        <Field
          label="Proof (check / receipt / PDF)"
          hint="Owner will see this attachment"
        >
          <S3Uploader
            scope="service-charge-proof"
            scopeId={propertyId}
            accept="image/*,application/pdf"
            value={proof}
            onChange={setProof}
            label=""
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
          <Button onClick={handleSave} loading={pending}>
            Mark paid
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
