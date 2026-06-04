"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { notify, NotificationType } from "@/lib/notify";

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
