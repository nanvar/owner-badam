"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

const AdvanceSchema = z.object({
  id: z.string().optional(),
  propertyId: z.string().min(1),
  date: z.string().min(1),
  concept: z.string().min(1).max(255),
  amount: z.coerce.number().nonnegative(),
});

export type AdvanceState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "error"; message: string };

export async function upsertAdvanceAction(
  _prev: AdvanceState | undefined,
  formData: FormData,
): Promise<AdvanceState> {
  await requireRole("ADMIN");
  const parsed = AdvanceSchema.safeParse({
    id: (formData.get("id") as string | null) || undefined,
    propertyId: formData.get("propertyId"),
    date: formData.get("date"),
    concept: formData.get("concept"),
    amount: formData.get("amount") || 0,
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const v = parsed.data;
  const date = new Date(v.date);
  if (v.id) {
    await prisma.advance.update({
      where: { id: v.id },
      data: {
        propertyId: v.propertyId,
        date,
        concept: v.concept,
        amount: v.amount,
      },
    });
  } else {
    await prisma.advance.create({
      data: {
        propertyId: v.propertyId,
        date,
        concept: v.concept,
        amount: v.amount,
      },
    });
  }
  revalidatePath("/", "layout");
  return { status: "ok" };
}

export async function deleteAdvanceAction(id: string) {
  await requireRole("ADMIN");
  await prisma.advance.delete({ where: { id } });
  revalidatePath("/", "layout");
}
