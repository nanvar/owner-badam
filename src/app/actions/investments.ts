"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

// Investment ledger entries are info-only. INCOME = capital received,
// SPEND = capital paid out (manually or auto from a property expense).
// Neither kind feeds into P&L, owner settlements, or any aggregate
// calculation; they only render on the investment ledger + the
// dashboard tile.
const Schema = z.object({
  id: z.string().optional(),
  kind: z.enum(["INCOME", "SPEND"]).default("INCOME"),
  amount: z.coerce.number().positive(),
  source: z.string().min(1).max(255),
  description: z.string().max(2000).optional().or(z.literal("")),
  date: z.string().min(1),
  propertyId: z.string().optional().or(z.literal("")),
});

export type InvestmentState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "error"; message: string };

export async function upsertInvestmentAction(
  _prev: InvestmentState | undefined,
  formData: FormData,
): Promise<InvestmentState> {
  await requireRole("SUPERADMIN");
  const parsed = Schema.safeParse({
    id: (formData.get("id") as string | null) || undefined,
    kind: (formData.get("kind") as string | null) || "INCOME",
    amount: formData.get("amount") || 0,
    source: (formData.get("source") as string | null) || "",
    description: (formData.get("description") as string | null) ?? "",
    date: formData.get("date"),
    propertyId: (formData.get("propertyId") as string | null) || "",
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
  const data = {
    kind: v.kind,
    amount: v.amount,
    source: v.source.trim(),
    description: v.description?.trim() || null,
    date,
    // Only SPEND rows can reference a property — INCOME stays
    // company-level. The Expense link is admin-only via the property
    // expense form and is never touched from this manual editor.
    propertyId: v.kind === "SPEND" && v.propertyId ? v.propertyId : null,
  };
  if (v.id) {
    await prisma.investment.update({ where: { id: v.id }, data });
  } else {
    await prisma.investment.create({ data });
  }
  return { status: "ok" };
}

export async function deleteInvestmentAction(id: string) {
  await requireRole("SUPERADMIN");
  // Auto-created SPEND rows (with expenseId) are owned by the expense
  // they were derived from — block standalone deletes to keep the
  // three-row contract intact. Admin must edit/delete the expense.
  const row = await prisma.investment.findUnique({
    where: { id },
    select: { expenseId: true },
  });
  if (row?.expenseId) {
    throw new Error(
      "This SPEND row was auto-created from a property expense. Edit that expense to change or remove it.",
    );
  }
  await prisma.investment.delete({ where: { id } });
}
