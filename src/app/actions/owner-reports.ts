"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { notify, NotificationType } from "@/lib/notify";
import { monthKeyFor } from "@/lib/utils";

const CreateReportSchema = z.object({
  propertyId: z.string().min(1),
  name: z.string().min(1).max(120),
  notes: z.string().max(2000).optional().or(z.literal("")),
  reservationIds: z.array(z.string().min(1)).default([]),
  extensionIds: z.array(z.string().min(1)).default([]),
  expenseIds: z.array(z.string().min(1)).default([]),
});

export type ReportState =
  | { status: "idle" }
  | { status: "ok"; reportId: string }
  | { status: "error"; message: string };

// Build a report by stamping selected reservations + extensions +
// expenses with the new report's id. Items already attached to another
// report are rejected — you can't bundle the same income twice.
export async function createOwnerReportAction(
  _prev: ReportState | undefined,
  formData: FormData,
): Promise<ReportState> {
  const session = await requireRole("ADMIN");
  const parsed = CreateReportSchema.safeParse({
    propertyId: formData.get("propertyId"),
    name: formData.get("name"),
    notes: formData.get("notes") || "",
    reservationIds: formData.getAll("reservationIds"),
    extensionIds: formData.getAll("extensionIds"),
    expenseIds: formData.getAll("expenseIds"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const v = parsed.data;
  if (
    v.reservationIds.length === 0 &&
    v.extensionIds.length === 0 &&
    v.expenseIds.length === 0
  ) {
    return {
      status: "error",
      message: "Pick at least one reservation, extension, or expense.",
    };
  }

  const property = await prisma.property.findUnique({
    where: { id: v.propertyId },
    select: { ownerId: true },
  });
  if (!property) {
    return { status: "error", message: "Property not found" };
  }

  // Sanity-check the picked items: same property, not already in a report.
  const [reservations, extensions, expenses] = await Promise.all([
    v.reservationIds.length
      ? prisma.reservation.findMany({
          where: { id: { in: v.reservationIds } },
          select: {
            id: true,
            propertyId: true,
            reportId: true,
            paid: true,
            payout: true,
            totalPrice: true,
          },
        })
      : Promise.resolve([]),
    v.extensionIds.length
      ? prisma.reservationExtension.findMany({
          where: { id: { in: v.extensionIds } },
          select: {
            id: true,
            reportId: true,
            paid: true,
            payout: true,
            totalPrice: true,
            reservation: { select: { propertyId: true } },
          },
        })
      : Promise.resolve([]),
    v.expenseIds.length
      ? prisma.expense.findMany({
          where: { id: { in: v.expenseIds } },
          select: {
            id: true,
            propertyId: true,
            reportId: true,
            amount: true,
          },
        })
      : Promise.resolve([]),
  ]);
  for (const r of reservations) {
    if (r.propertyId !== v.propertyId) {
      return { status: "error", message: "Reservation belongs to another property." };
    }
    if (r.reportId) {
      return { status: "error", message: "One of the reservations is already in a report." };
    }
    if (!r.paid) {
      return {
        status: "error",
        message:
          "Only guest-paid reservations can be settled. Mark the reservation paid first.",
      };
    }
  }
  for (const ext of extensions) {
    if (ext.reservation.propertyId !== v.propertyId) {
      return { status: "error", message: "Extension belongs to another property." };
    }
    if (ext.reportId) {
      return { status: "error", message: "One of the extensions is already in a report." };
    }
    if (!ext.paid) {
      return {
        status: "error",
        message:
          "Only guest-paid extensions can be settled. Mark the extension paid first.",
      };
    }
  }
  for (const e of expenses) {
    if (e.propertyId !== v.propertyId) {
      return { status: "error", message: "Expense belongs to another property." };
    }
    if (e.reportId) {
      return { status: "error", message: "One of the expenses is already in a report." };
    }
  }

  // Snapshot totals so the report stays stable even if rows get edited.
  // Income = reservation payouts + extension payouts.
  const totalIncome =
    reservations.reduce((s, r) => s + r.payout, 0) +
    extensions.reduce((s, e) => s + e.payout, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const netPayout = totalIncome - totalExpenses;

  const report = await prisma.$transaction(async (tx) => {
    const created = await tx.ownerReport.create({
      data: {
        ownerId: property.ownerId,
        propertyId: v.propertyId,
        name: v.name,
        notes: v.notes || null,
        totalIncome,
        totalExpenses,
        netPayout,
        createdById: session.userId,
      },
    });
    if (v.reservationIds.length) {
      await tx.reservation.updateMany({
        where: { id: { in: v.reservationIds } },
        data: { reportId: created.id },
      });
    }
    if (v.extensionIds.length) {
      await tx.reservationExtension.updateMany({
        where: { id: { in: v.extensionIds } },
        data: { reportId: created.id },
      });
    }
    if (v.expenseIds.length) {
      await tx.expense.updateMany({
        where: { id: { in: v.expenseIds } },
        data: { reportId: created.id },
      });
    }
    return created;
  });

  notify({
    userId: property.ownerId,
    type: NotificationType.NEW_REPORT,
    title: "New report ready",
    body: `${v.name} · ${netPayout.toLocaleString("en-GB", { style: "currency", currency: "AED", maximumFractionDigits: 2 })} net`,
    url: `/owner/reports/${report.id}`,
    data: { reportId: report.id, name: v.name, netPayout },
  }).catch(() => {});

  return { status: "ok", reportId: report.id };
}

// Free-form payment method — UI offers a curated preset list (Cash,
// Bank transfer, Card, Cheque, Wire, PayPal, Stripe, Western Union,
// Crypto) plus a "Custom" text input, all stored as a short lowercase
// slug so the dashboard breakdown can group identical methods cleanly.
const PayReportSchema = z.object({
  reportId: z.string().min(1),
  date: z.string().min(1),
  method: z.string().min(1).max(32),
  reference: z.string().max(120).optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export type PayReportState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "error"; message: string };

// Settle a report: stamp the report with paid metadata AND create the
// matching OwnerPayment row so the cash-out trail and the owner-side
// "Payments received" feed both stay in sync. Re-running on an already
// paid report is rejected — undo via `unpayReportAction` first.
export async function payReportAction(
  _prev: PayReportState | undefined,
  formData: FormData,
): Promise<PayReportState> {
  const session = await requireRole("ADMIN");
  const parsed = PayReportSchema.safeParse({
    reportId: formData.get("reportId"),
    date: formData.get("date"),
    method: formData.get("method"),
    reference: formData.get("reference") || "",
    notes: formData.get("notes") || "",
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const v = parsed.data;
  const date = new Date(v.date);
  if (Number.isNaN(date.getTime())) {
    return { status: "error", message: "Invalid date" };
  }
  const report = await prisma.ownerReport.findUnique({
    where: { id: v.reportId },
    select: {
      id: true,
      ownerId: true,
      propertyId: true,
      name: true,
      netPayout: true,
      paidAt: true,
      // Live items so the settlement amount reflects ONLY paid
      // reservations / extensions — unpaid items must not inflate the
      // owner payout the company is about to disburse.
      reservations: { select: { paid: true, payout: true } },
      extensions: { select: { paid: true, payout: true } },
      expenses: { select: { amount: true, paidFromCompanyInvest: true } },
    },
  });
  if (!report) return { status: "error", message: "Report not found" };
  if (report.paidAt) {
    return { status: "error", message: "Report already paid" };
  }

  const liveIncome =
    report.reservations
      .filter((r) => r.paid)
      .reduce((s, r) => s + r.payout, 0) +
    report.extensions
      .filter((e) => e.paid)
      .reduce((s, e) => s + e.payout, 0);
  // Mirror the dashboard rule: company-invest expenses don't reduce the
  // owner's settlement amount — those have an OwnerDebt lifecycle and
  // the owner never paid for them. Including them here would create a
  // phantom negative OwnerPayment that drags the Owner-payout KPI.
  const liveExpenses = report.expenses
    .filter((e) => !e.paidFromCompanyInvest)
    .reduce((s, e) => s + e.amount, 0);
  const liveNet = liveIncome - liveExpenses;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.ownerReport.update({
        where: { id: report.id },
        data: {
          paidAt: date,
          paidMethod: v.method,
          paidReference: v.reference || null,
          // Refresh the snapshot so subsequent reads (Owner reports
          // list totals, audit) match what was actually disbursed.
          netPayout: liveNet,
          totalIncome: liveIncome,
          totalExpenses: liveExpenses,
        },
      });
      // Skip the cash-out row when liveNet ≤ 0: no cash actually
      // changed hands, so creating an OwnerPayment would be a phantom
      // entry that breaks the Owner-payout math (subtracting a negative
      // inflates outstanding). Report still marked paid for the audit
      // trail.
      if (liveNet > 0) {
        await tx.ownerPayment.create({
          data: {
            ownerId: report.ownerId,
            propertyId: report.propertyId,
            date,
            amount: liveNet,
            method: v.method,
            reference: v.reference || null,
            // Compose the OwnerPayment notes: always link back to the
            // report name, append admin-supplied notes when present.
            notes: v.notes
              ? `Settlement: ${report.name} — ${v.notes}`
              : `Settlement: ${report.name}`,
            monthKey: monthKeyFor(date),
            reportId: report.id,
            recordedById: session.userId,
          },
        });
      }
    });
  } catch (err) {
    console.error("[report-pay] failed:", err);
    return {
      status: "error",
      message: (err as Error).message ?? "Failed to record payment",
    };
  }

  notify({
    userId: report.ownerId,
    type: NotificationType.OWNER_PAYMENT_RECORDED,
    title: "Payout received",
    body: `${liveNet.toLocaleString("en-GB", { style: "currency", currency: "AED", maximumFractionDigits: 2 })} · ${report.name}`,
    url: `/owner/reports/${report.id}`,
    data: { reportId: report.id, amount: liveNet, method: v.method },
  }).catch(() => {});

  return { status: "ok" };
}

// Reverse `payReportAction`: clear the paid stamps on the report and
// remove the linked OwnerPayment row. Used when a settlement is recorded
// by mistake — the report goes back into the Unpaid tab.
export async function unpayReportAction(reportId: string) {
  await requireRole("ADMIN");
  await prisma.$transaction([
    prisma.ownerPayment.deleteMany({ where: { reportId } }),
    prisma.ownerReport.update({
      where: { id: reportId },
      data: { paidAt: null, paidMethod: null, paidReference: null },
    }),
  ]);
}

// Delete a report, releasing its items (reservations / extensions /
// expenses) back into the picker. The DB-level ON DELETE SET NULL
// already nulls each child's reportId, but we do it explicitly inside a
// transaction so the behaviour is obvious at the application layer too.
//
// ALSO deletes any OwnerPayment that was created by paying this report
// (reportId match): without this they'd become orphans (reportId null
// after the FK cascade) and keep counting against Owner-payout
// outstanding, dragging it negative once the items get rebundled into a
// fresh report. The audit trail still lives in git / ActivityEvent.
export async function deleteOwnerReportAction(id: string) {
  await requireRole("ADMIN");
  await prisma.$transaction([
    prisma.ownerPayment.deleteMany({ where: { reportId: id } }),
    prisma.reservation.updateMany({
      where: { reportId: id },
      data: { reportId: null },
    }),
    prisma.reservationExtension.updateMany({
      where: { reportId: id },
      data: { reportId: null },
    }),
    prisma.expense.updateMany({
      where: { reportId: id },
      data: { reportId: null },
    }),
    prisma.ownerReport.delete({ where: { id } }),
  ]);
}
