"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

// Investments are info-only capital injections. They never feed into
// P&L, owner settlements, or any aggregate calculation. The schema
// just captures the bare facts: who/where, amount, optional note, and
// a date the admin picked (default = today, set client-side).
const Schema = z.object({
  id: z.string().optional(),
  amount: z.coerce.number().positive(),
  source: z.string().min(1).max(255),
  description: z.string().max(2000).optional().or(z.literal("")),
  date: z.string().min(1),
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
    amount: formData.get("amount") || 0,
    source: (formData.get("source") as string | null) || "",
    description: (formData.get("description") as string | null) ?? "",
    date: formData.get("date"),
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
    amount: v.amount,
    source: v.source.trim(),
    description: v.description?.trim() || null,
    date,
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
  await prisma.investment.delete({ where: { id } });
}
