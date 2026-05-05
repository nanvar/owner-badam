"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { EXPENSE_TYPES } from "@/lib/expense-types";

const ExpenseSchema = z
  .object({
    id: z.string().optional(),
    propertyId: z.string().min(1),
    date: z.string().min(1),
    type: z.enum(EXPENSE_TYPES),
    description: z.string().max(500).optional().or(z.literal("")),
    amount: z.coerce.number().nonnegative(),
  })
  // Description is mandatory only for OTHERS — typed expenses (DEWA, GAS …)
  // are self-explanatory.
  .refine(
    (v) => v.type !== "OTHERS" || (v.description && v.description.trim().length > 0),
    {
      message: "Description is required for Others",
      path: ["description"],
    },
  );

export type ExpenseState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "error"; message: string };

export async function upsertExpenseAction(
  _prev: ExpenseState | undefined,
  formData: FormData,
): Promise<ExpenseState> {
  await requireRole("ADMIN");
  const parsed = ExpenseSchema.safeParse({
    id: (formData.get("id") as string | null) || undefined,
    propertyId: formData.get("propertyId"),
    date: formData.get("date"),
    type: formData.get("type"),
    description: formData.get("description"),
    amount: formData.get("amount") || 0,
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const v = parsed.data;
  const date = new Date(v.date);
  if (v.id) {
    await prisma.expense.update({
      where: { id: v.id },
      data: {
        propertyId: v.propertyId,
        date,
        type: v.type,
        description: v.description ?? "",
        amount: v.amount,
      },
    });
  } else {
    await prisma.expense.create({
      data: {
        propertyId: v.propertyId,
        date,
        type: v.type,
        description: v.description ?? "",
        amount: v.amount,
      },
    });
  }
  return { status: "ok" };
}

export async function deleteExpenseAction(id: string) {
  await requireRole("ADMIN");
  await prisma.expense.delete({ where: { id } });
}
