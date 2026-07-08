"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { notify, NotificationType } from "@/lib/notify";

const CreateOwnerDebtSchema = z.object({
  ownerId: z.string().min(1),
  propertyId: z.string().optional().or(z.literal("")),
  amount: z.coerce.number().positive(),
  description: z.string().max(300).optional().or(z.literal("")),
});

export type CreateOwnerDebtState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "error"; message: string };

// Manual OwnerDebt entry — for cases outside the expense flow: an
// owner owes the company money that admin needs to log directly
// (adjustments, one-off charges, historical balances). The row lands
// as PENDING and moves through the standard mark-paid lifecycle.
export async function createOwnerDebtManualAction(
  _prev: CreateOwnerDebtState | undefined,
  formData: FormData,
): Promise<CreateOwnerDebtState> {
  await requireRole("ADMIN");
  const parsed = CreateOwnerDebtSchema.safeParse({
    ownerId: formData.get("ownerId"),
    propertyId: formData.get("propertyId") || "",
    amount: formData.get("amount") || 0,
    description: formData.get("description") || "",
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const v = parsed.data;
  try {
    await prisma.ownerDebt.create({
      data: {
        ownerId: v.ownerId,
        propertyId: v.propertyId || null,
        amount: v.amount,
        description: v.description || null,
        status: "PENDING",
      },
    });
  } catch (err) {
    console.error("[owner-debt] create failed:", err);
    return {
      status: "error",
      message: (err as Error).message ?? "Failed to create debt",
    };
  }
  return { status: "ok" };
}

// Flip a debt to PAID — admin used this when the owner reimburses
// the company for an expense the company fronted via invested
// capital. Idempotent: re-marking a PAID row is a no-op.
export async function markOwnerDebtPaidAction(id: string) {
  await requireRole("ADMIN");
  const updated = await prisma.ownerDebt.update({
    where: { id },
    data: { status: "PAID", paidAt: new Date() },
    include: { property: { select: { name: true } } },
  });
  notify({
    userId: updated.ownerId,
    type: NotificationType.OWNER_DEBT_SETTLED,
    title: `Debt settled`,
    body: `AED ${updated.amount.toLocaleString("en-GB", { maximumFractionDigits: 0 })}${updated.property ? ` · ${updated.property.name}` : ""}`,
    url: "/owner",
    data: { debtId: updated.id, amount: updated.amount },
  }).catch(() => {});
}

// Undo a paid mark — fixing a mistake. Restores PENDING + clears the
// paidAt timestamp.
export async function markOwnerDebtPendingAction(id: string) {
  await requireRole("ADMIN");
  await prisma.ownerDebt.update({
    where: { id },
    data: { status: "PENDING", paidAt: null },
  });
}

export async function deleteOwnerDebtAction(id: string) {
  await requireRole("SUPERADMIN");
  // We only allow deleting orphan rows (no source expense). For
  // expense-linked rows the admin should edit the parent expense.
  const row = await prisma.ownerDebt.findUnique({
    where: { id },
    select: { expenseId: true },
  });
  if (row?.expenseId) {
    throw new Error(
      "This debt is tied to a property expense. Edit or delete that expense to remove the debt.",
    );
  }
  await prisma.ownerDebt.delete({ where: { id } });
}
