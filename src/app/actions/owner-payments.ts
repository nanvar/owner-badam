"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

const OwnerPaymentSchema = z.object({
  ownerId: z.string().min(1),
  date: z.string().min(1),
  amount: z.coerce.number().positive(),
  method: z.string().max(60).optional().or(z.literal("")),
  reference: z.string().max(120).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export type OwnerPaymentState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "error"; message: string };

export async function createOwnerPaymentAction(
  _prev: OwnerPaymentState | undefined,
  formData: FormData,
): Promise<OwnerPaymentState> {
  const session = await requireRole("ADMIN");
  const parsed = OwnerPaymentSchema.safeParse({
    ownerId: formData.get("ownerId"),
    date: formData.get("date"),
    amount: formData.get("amount") || 0,
    method: formData.get("method") || "",
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
  await prisma.ownerPayment.create({
    data: {
      ownerId: v.ownerId,
      date,
      amount: v.amount,
      method: v.method || null,
      reference: v.reference || null,
      notes: v.notes || null,
      recordedById: session.userId,
    },
  });
  return { status: "ok" };
}

export async function deleteOwnerPaymentAction(id: string) {
  await requireRole("ADMIN");
  await prisma.ownerPayment.delete({ where: { id } });
}
