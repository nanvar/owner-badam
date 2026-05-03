"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { pushToOwner } from "@/lib/push";

const CreateReportSchema = z.object({
  propertyId: z.string().min(1),
  name: z.string().min(1).max(120),
  notes: z.string().max(2000).optional().or(z.literal("")),
  reservationIds: z.array(z.string().min(1)).default([]),
  expenseIds: z.array(z.string().min(1)).default([]),
});

export type ReportState =
  | { status: "idle" }
  | { status: "ok"; reportId: string }
  | { status: "error"; message: string };

// Build a report by stamping selected reservations + expenses with the
// new report's id. Items already attached to another report are rejected
// — you can't bundle the same income twice.
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
    expenseIds: formData.getAll("expenseIds"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const v = parsed.data;
  if (v.reservationIds.length === 0 && v.expenseIds.length === 0) {
    return {
      status: "error",
      message: "Pick at least one reservation or expense for the report.",
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
  const [reservations, expenses] = await Promise.all([
    v.reservationIds.length
      ? prisma.reservation.findMany({
          where: { id: { in: v.reservationIds } },
          select: {
            id: true,
            propertyId: true,
            reportId: true,
            payout: true,
            totalPrice: true,
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
  const totalIncome = reservations.reduce((s, r) => s + r.payout, 0);
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
    if (v.expenseIds.length) {
      await tx.expense.updateMany({
        where: { id: { in: v.expenseIds } },
        data: { reportId: created.id },
      });
    }
    return created;
  });

  pushToOwner(property.ownerId, {
    title: "New report ready",
    body: `${v.name} · ${netPayout.toLocaleString("en-GB", { style: "currency", currency: "AED", maximumFractionDigits: 2 })} net`,
    data: { type: "report", reportId: report.id },
  }).catch(() => {});

  return { status: "ok", reportId: report.id };
}

// Delete a report, releasing its items back into the picker. The DB-level
// ON DELETE SET NULL already nulls reservation.reportId / expense.reportId,
// but we do it explicitly inside a transaction so the behaviour is obvious
// at the application layer too.
export async function deleteOwnerReportAction(id: string) {
  await requireRole("ADMIN");
  await prisma.$transaction([
    prisma.reservation.updateMany({
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
