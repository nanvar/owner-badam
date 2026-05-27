"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { COMPANY_EXPENSE_CATEGORIES } from "@/lib/company-expense-types";
import { monthKeyFor } from "@/lib/utils";

// Discriminated schema covers EXPENSE (with category, no property),
// PROFIT (with property + description), and DEPOSIT (with property + amount;
// description optional, lifecycle tracked via refund fields).
const Schema = z
  .object({
    id: z.string().optional(),
    kind: z.enum(["EXPENSE", "PROFIT", "DEPOSIT"]).default("EXPENSE"),
    propertyId: z.string().optional().or(z.literal("")),
    date: z.string().min(1),
    category: z
      .enum(COMPANY_EXPENSE_CATEGORIES)
      .optional()
      .or(z.literal("")),
    description: z.string().max(500).optional().or(z.literal("")),
    amount: z.coerce.number().nonnegative(),
    monthKey: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional()
      .or(z.literal("")),
    paid: z.boolean().optional().default(true),
  })
  .refine(
    (v) =>
      v.kind === "EXPENSE"
        ? !!v.category && v.category.length > 0
        : !!v.propertyId && v.propertyId.length > 0,
    {
      message:
        "Expenses need a category, profit/deposit entries need a property.",
      path: ["kind"],
    },
  )
  // Description is required only when the entry needs a free-text label:
  // EXPENSE with category OTHER, or PROFIT (description explains it).
  // DEPOSIT description is optional.
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
  // Checkbox-style boolean: missing field = unchecked = false; the
  // ProfitEditor mirrors the checkbox into a hidden "paid" input with
  // value "true"/"false". For EXPENSE/DEPOSIT (no toggle) the form
  // omits the field and we fall back to true so legacy entries keep
  // counting toward KPIs.
  const paidRaw = formData.get("paid") as string | null;
  const paid =
    paidRaw === null ? true : paidRaw === "true" || paidRaw === "on" || paidRaw === "1";
  const parsed = Schema.safeParse({
    id: (formData.get("id") as string | null) || undefined,
    kind: (formData.get("kind") as string | null) || "EXPENSE",
    propertyId: (formData.get("propertyId") as string | null) || "",
    date: formData.get("date"),
    category: (formData.get("category") as string | null) || "",
    description: (formData.get("description") as string | null) ?? "",
    amount: formData.get("amount") || 0,
    monthKey: (formData.get("monthKey") as string | null) ?? "",
    paid,
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
    monthKey: v.monthKey || monthKeyFor(date),
    // PROFIT and DEPOSIT honour the toggle — both can be entered
    // before the cash actually changes hands. EXPENSE is always
    // stored as paid since recording one already means we paid.
    paid: v.kind === "EXPENSE" ? true : v.paid,
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

// Mark a DEPOSIT as paid back. Stores the refund amount + date so the
// timeline is auditable.
const RefundSchema = z.object({
  id: z.string().min(1),
  refundedAt: z.string().min(1),
  refundedAmount: z.coerce.number().nonnegative(),
});

export async function refundDepositAction(
  _prev: CompanyExpenseState | undefined,
  formData: FormData,
): Promise<CompanyExpenseState> {
  await requireRole("SUPERADMIN");
  const parsed = RefundSchema.safeParse({
    id: formData.get("id"),
    refundedAt: formData.get("refundedAt"),
    refundedAmount: formData.get("refundedAmount") || 0,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const v = parsed.data;
  const refundedAt = new Date(v.refundedAt);
  if (Number.isNaN(refundedAt.getTime())) {
    return { status: "error", message: "Invalid date" };
  }
  await prisma.companyExpense.update({
    where: { id: v.id },
    data: {
      refundedAt,
      refundedAmount: v.refundedAmount,
    },
  });
  return { status: "ok" };
}

export async function unrefundDepositAction(id: string) {
  await requireRole("SUPERADMIN");
  await prisma.companyExpense.update({
    where: { id },
    data: { refundedAt: null, refundedAmount: null },
  });
}
