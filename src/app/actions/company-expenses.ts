"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { COMPANY_EXPENSE_CATEGORIES } from "@/lib/company-expense-types";

// Single discriminated schema covers both EXPENSE (with category, no
// property) and PROFIT (with property, no category). Anything caller-side
// that submits the wrong combination falls into the refine error.
const Schema = z
  .object({
    id: z.string().optional(),
    kind: z.enum(["EXPENSE", "PROFIT"]).default("EXPENSE"),
    propertyId: z.string().optional().or(z.literal("")),
    date: z.string().min(1),
    category: z
      .enum(COMPANY_EXPENSE_CATEGORIES)
      .optional()
      .or(z.literal("")),
    description: z.string().max(500).optional().or(z.literal("")),
    amount: z.coerce.number().nonnegative(),
  })
  .refine(
    (v) =>
      v.kind === "EXPENSE"
        ? !!v.category && v.category.length > 0
        : !!v.propertyId && v.propertyId.length > 0,
    {
      message:
        "Expenses need a category, profit entries need a property.",
      path: ["kind"],
    },
  )
  // Description is required only when the entry needs a free-text label:
  // EXPENSE with category OTHER, or PROFIT (which has no category to
  // describe what the income is for).
  .refine(
    (v) => {
      const needs =
        (v.kind === "EXPENSE" && v.category === "OTHER") || v.kind === "PROFIT";
      return needs ? !!v.description && v.description.trim().length > 0 : true;
    },
    {
      message: "Description is required",
      path: ["description"],
    },
  );

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
    kind: (formData.get("kind") as string | null) || "EXPENSE",
    propertyId: (formData.get("propertyId") as string | null) || "",
    date: formData.get("date"),
    category: (formData.get("category") as string | null) || "",
    description: (formData.get("description") as string | null) ?? "",
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
  const isExpense = v.kind === "EXPENSE";
  const data = {
    kind: v.kind,
    date,
    description: v.description ?? "",
    amount: v.amount,
    category: isExpense
      ? (v.category as (typeof COMPANY_EXPENSE_CATEGORIES)[number])
      : null,
    propertyId: isExpense ? null : v.propertyId || null,
  };
  if (v.id) {
    await prisma.companyExpense.update({
      where: { id: v.id },
      data,
    });
  } else {
    await prisma.companyExpense.create({ data });
  }
  return { status: "ok" };
}

export async function deleteCompanyExpenseAction(id: string) {
  await requireRole("SUPERADMIN");
  await prisma.companyExpense.delete({ where: { id } });
}
