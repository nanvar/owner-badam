"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { EXPENSE_TYPES } from "@/lib/expense-types";
import { monthKeyFor } from "@/lib/utils";
import { notify, NotificationType } from "@/lib/notify";

const ExpenseSchema = z
  .object({
    id: z.string().optional(),
    propertyId: z.string().min(1),
    date: z.string().min(1),
    type: z.enum(EXPENSE_TYPES),
    description: z.string().max(500).optional().or(z.literal("")),
    amount: z.coerce.number().nonnegative(),
    monthKey: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional()
      .or(z.literal("")),
    paidFromCompanyInvest: z.boolean().optional().default(false),
    // Receipt — already uploaded to S3 via the presigned PUT. The form
    // ships {url, fileName, fileSize, mimeType}; we mint a
    // PropertyMedia row inside the same transaction so the owner can
    // see + verify the spend.
    receiptUrl: z.string().url().optional().or(z.literal("")),
    receiptFileName: z.string().max(255).optional().or(z.literal("")),
    receiptFileSize: z.coerce.number().int().nonnegative().optional(),
    receiptMimeType: z.string().max(120).optional().or(z.literal("")),
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
  const session = await requireRole("ADMIN");
  // Checkbox-style boolean: hidden mirror input from the form sends
  // "true" / "false" so the action gets an explicit value. Missing
  // field defaults to false (default behavior — owner pays the bill).
  const paidFromCompanyInvestRaw = formData.get(
    "paidFromCompanyInvest",
  ) as string | null;
  const paidFromCompanyInvest =
    paidFromCompanyInvestRaw === "true" ||
    paidFromCompanyInvestRaw === "on" ||
    paidFromCompanyInvestRaw === "1";
  const parsed = ExpenseSchema.safeParse({
    id: (formData.get("id") as string | null) || undefined,
    propertyId: formData.get("propertyId"),
    date: formData.get("date"),
    type: formData.get("type"),
    description: (formData.get("description") as string | null) ?? "",
    amount: formData.get("amount") || 0,
    monthKey: (formData.get("monthKey") as string | null) ?? "",
    paidFromCompanyInvest,
    receiptUrl: (formData.get("receiptUrl") as string | null) ?? "",
    receiptFileName: (formData.get("receiptFileName") as string | null) ?? "",
    receiptFileSize: formData.get("receiptFileSize") || undefined,
    receiptMimeType: (formData.get("receiptMimeType") as string | null) ?? "",
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const v = parsed.data;
  const date = new Date(v.date);
  const monthKey = v.monthKey || monthKeyFor(date);

  // If the form shipped a receipt URL, mint a PropertyMedia row up
  // front. The Expense row will reference it via receiptMediaId so
  // the file is one click away from the owner's expense list.
  let receiptMediaId: string | null = null;
  if (v.receiptUrl) {
    const created = await prisma.propertyMedia.create({
      data: {
        propertyId: v.propertyId,
        kind: "RECEIPT",
        url: v.receiptUrl,
        fileName: v.receiptFileName || null,
        fileSize: v.receiptFileSize ?? null,
        mimeType: v.receiptMimeType || null,
        uploadedById: session.userId,
      },
      select: { id: true },
    });
    receiptMediaId = created.id;
  }

  const data = {
    propertyId: v.propertyId,
    date,
    type: v.type,
    description: v.description ?? "",
    amount: v.amount,
    monthKey,
    paidFromCompanyInvest: v.paidFromCompanyInvest,
    ...(receiptMediaId ? { receiptMediaId } : {}),
  };

  // We need the property's owner to mint the OwnerDebt when this is
  // a "paid from company invest" expense. One query covers create,
  // update, and the no-op case.
  const propertyForOwner = v.paidFromCompanyInvest
    ? await prisma.property.findUnique({
        where: { id: v.propertyId },
        select: { ownerId: true, name: true },
      })
    : null;
  if (v.paidFromCompanyInvest && !propertyForOwner) {
    return { status: "error", message: "Property not found" };
  }

  if (v.id) {
    // Update path. If the flag is currently true, we keep the
    // companion Investment SPEND + OwnerDebt rows in sync; if the
    // flag was flipped off we clear them. If it was flipped on we
    // create fresh ones. Everything runs in a single transaction so
    // the three tables can never drift.
    await prisma.$transaction(async (tx) => {
      const existing = await tx.expense.findUnique({
        where: { id: v.id! },
        select: { paidFromCompanyInvest: true },
      });
      await tx.expense.update({ where: { id: v.id! }, data });
      if (v.paidFromCompanyInvest) {
        await tx.investment.upsert({
          where: { expenseId: v.id! },
          create: {
            kind: "SPEND",
            amount: v.amount,
            source: `${v.type} · ${propertyForOwner!.name}`,
            description: v.description || null,
            date,
            propertyId: v.propertyId,
            expenseId: v.id!,
          },
          update: {
            amount: v.amount,
            source: `${v.type} · ${propertyForOwner!.name}`,
            description: v.description || null,
            date,
            propertyId: v.propertyId,
          },
        });
        await tx.ownerDebt.upsert({
          where: { expenseId: v.id! },
          create: {
            ownerId: propertyForOwner!.ownerId,
            propertyId: v.propertyId,
            expenseId: v.id!,
            amount: v.amount,
            description: v.description || null,
          },
          update: {
            ownerId: propertyForOwner!.ownerId,
            propertyId: v.propertyId,
            amount: v.amount,
            description: v.description || null,
            // Don't touch status on an edit — if the debt was already
            // PAID, the admin marked it settled deliberately.
          },
        });
      } else if (existing?.paidFromCompanyInvest) {
        // Flag flipped off: drop the companion rows. Cascade on the
        // FK does the heavy lifting if we instead deleted the
        // Expense, but here the Expense itself stays.
        await tx.investment.deleteMany({
          where: { expenseId: v.id! },
        });
        await tx.ownerDebt.deleteMany({
          where: { expenseId: v.id! },
        });
      }
    });
  } else {
    // Create path. Same transactional triple-write when the flag is
    // on; plain create otherwise.
    if (v.paidFromCompanyInvest) {
      await prisma.$transaction(async (tx) => {
        const created = await tx.expense.create({ data });
        await tx.investment.create({
          data: {
            kind: "SPEND",
            amount: v.amount,
            source: `${v.type} · ${propertyForOwner!.name}`,
            description: v.description || null,
            date,
            propertyId: v.propertyId,
            expenseId: created.id,
          },
        });
        await tx.ownerDebt.create({
          data: {
            ownerId: propertyForOwner!.ownerId,
            propertyId: v.propertyId,
            expenseId: created.id,
            amount: v.amount,
            description: v.description || null,
          },
        });
      });
      // Two events fire for an "from company invest" expense — both
      // are noteworthy to the owner.
      notify({
        userId: propertyForOwner!.ownerId,
        type: NotificationType.NEW_EXPENSE,
        title: `New expense · ${propertyForOwner!.name}`,
        body: `${v.type} · AED ${v.amount.toLocaleString("en-GB", { maximumFractionDigits: 0 })} (paid by management)`,
        url: "/owner",
        data: {
          propertyId: v.propertyId,
          amount: v.amount,
          type: v.type,
          paidFromCompanyInvest: true,
        },
      }).catch(() => {});
      notify({
        userId: propertyForOwner!.ownerId,
        type: NotificationType.OWNER_DEBT_CREATED,
        title: `New debt logged`,
        body: `${v.type} on ${propertyForOwner!.name} · AED ${v.amount.toLocaleString("en-GB", { maximumFractionDigits: 0 })} owed to management`,
        url: "/owner",
        data: { propertyId: v.propertyId, amount: v.amount, type: v.type },
      }).catch(() => {});
    } else {
      // Regular owner-paid expense — fetch owner for the activity feed.
      const created = await prisma.expense.create({
        data,
        include: { property: { select: { ownerId: true, name: true } } },
      });
      notify({
        userId: created.property.ownerId,
        type: NotificationType.NEW_EXPENSE,
        title: `New expense · ${created.property.name}`,
        body: `${v.type} · AED ${v.amount.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`,
        url: "/owner",
        data: {
          propertyId: v.propertyId,
          expenseId: created.id,
          amount: v.amount,
          type: v.type,
        },
      }).catch(() => {});
    }
  }
  return { status: "ok" };
}

export async function deleteExpenseAction(id: string) {
  await requireRole("ADMIN");
  await prisma.expense.delete({ where: { id } });
}
