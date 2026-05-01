"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { COMPANY_EXPENSE_CATEGORIES } from "@/lib/company-expense-types";

const Schema = z.object({
  id: z.string().optional(),
  date: z.string().min(1),
  category: z.enum(COMPANY_EXPENSE_CATEGORIES),
  description: z.string().min(1).max(500),
  amount: z.coerce.number().nonnegative(),
});

export type CompanyExpenseState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "error"; message: string };

export async function upsertCompanyExpenseAction(
  _prev: CompanyExpenseState | undefined,
  formData: FormData,
): Promise<CompanyExpenseState> {
  await requireRole("SUPERADMIN");
  const parsed = Schema.safeParse({
    id: (formData.get("id") as string | null) || undefined,
    date: formData.get("date"),
    category: formData.get("category"),
    description: formData.get("description"),
    amount: formData.get("amount") || 0,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const v = parsed.data;
  const date = new Date(v.date);
  if (v.id) {
    await prisma.companyExpense.update({
      where: { id: v.id },
      data: {
        date,
        category: v.category,
        description: v.description,
        amount: v.amount,
      },
    });
  } else {
    await prisma.companyExpense.create({
      data: {
        date,
        category: v.category,
        description: v.description,
        amount: v.amount,
      },
    });
  }
  return { status: "ok" };
}

export async function deleteCompanyExpenseAction(id: string) {
  await requireRole("SUPERADMIN");
  await prisma.companyExpense.delete({ where: { id } });
}
