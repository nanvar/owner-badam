"use client";

// "Undo" trigger for paid reports. Confirms before reversing because
// the action deletes the linked OwnerPayment row (audit trail loss).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Undo2, X, Loader2 } from "lucide-react";
import { unpayReportAction } from "@/app/actions/owner-reports";

export function ReportUnpayButton({
  reportId,
  reportName,
}: {
  reportId: string;
  reportName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const confirm = () => {
    start(async () => {
      await unpayReportAction(reportId);
      router.refresh();
      setOpen(false);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--color-muted)] hover:text-rose-600"
        title="Mark report as unpaid"
      >
        <Undo2 className="h-3 w-3" />
        Undo
      </button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
              onClick={() => !pending && setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
              <div className="flex items-start justify-between gap-2 p-4">
                <div className="min-w-0">
                  <div className="text-base font-bold">Mark as unpaid?</div>
                  <div className="mt-1 text-xs text-[var(--color-muted)]">
                    The settlement payment recorded for{" "}
                    <span className="font-semibold text-[var(--color-foreground)]">
                      {reportName}
                    </span>{" "}
                    will be deleted and the report moves back to the Unpaid tab.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => !pending && setOpen(false)}
                  aria-label="Close"
                  disabled={pending}
                  className="grid h-8 w-8 place-items-center rounded-lg text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-3">
                <button
                  type="button"
                  onClick={() => !pending && setOpen(false)}
                  disabled={pending}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--color-muted)] hover:bg-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirm}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-700 disabled:opacity-60"
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Undo2 className="h-4 w-4" />
                  )}
                  {pending ? "Reverting…" : "Mark unpaid"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
