"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { monthKeyFor } from "@/lib/utils";

const ExtensionSchema = z.object({
  id: z.string().optional().or(z.literal("")),
  reservationId: z.string().min(1),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  totalPrice: z.coerce.number().nonnegative().default(0),
  agencyCommission: z.coerce.number().nonnegative().default(0),
  portalCommission: z.coerce.number().nonnegative().default(0),
  currency: z.string().default("AED"),
  notes: z.string().max(2000).optional().or(z.literal("")),
  paid: z.coerce.boolean().optional(),
  monthKey: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional()
    .or(z.literal("")),
});

export type ReservationExtensionState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "error"; message: string };

// Create or update an extension. Pricing fields stay zero on creation
// (admins fill them in afterwards) so a sync-time placeholder is OK.
export async function upsertReservationExtensionAction(
  _prev: ReservationExtensionState | undefined,
  formData: FormData,
): Promise<ReservationExtensionState> {
  await requireRole("ADMIN");
  const parsed = ExtensionSchema.safeParse({
    id: formData.get("id") || "",
    reservationId: formData.get("reservationId"),
    checkIn: formData.get("checkIn"),
    checkOut: formData.get("checkOut"),
    totalPrice: formData.get("totalPrice") || 0,
    agencyCommission: formData.get("agencyCommission") || 0,
    portalCommission: formData.get("portalCommission") || 0,
    currency: (formData.get("currency") as string) || "AED",
    notes: formData.get("notes") || "",
    paid: formData.get("paid") === "on" || formData.get("paid") === "true",
    monthKey: (formData.get("monthKey") as string | null) ?? "",
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const data = parsed.data;
  const checkIn = new Date(data.checkIn);
  const checkOut = new Date(data.checkOut);
  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
    return { status: "error", message: "Invalid dates" };
  }
  if (checkOut <= checkIn) {
    return { status: "error", message: "Check-out must be after check-in" };
  }
  const nights = Math.max(
    1,
    Math.round(
      (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24),
    ),
  );
  const payout = Math.max(
    0,
    data.totalPrice - data.agencyCommission - data.portalCommission,
  );
  const monthKey = data.monthKey || monthKeyFor(checkIn);

  if (data.id) {
    await prisma.reservationExtension.update({
      where: { id: data.id },
      data: {
        checkIn,
        checkOut,
        nights,
        totalPrice: data.totalPrice,
        agencyCommission: data.agencyCommission,
        portalCommission: data.portalCommission,
        payout,
        currency: data.currency,
        notes: data.notes || null,
        paid: data.paid ?? false,
        monthKey,
        // Once an admin saves the editor, the row is no longer a
        // placeholder from sync.
        detailsFilled: true,
      },
    });
  } else {
    await prisma.reservationExtension.create({
      data: {
        reservationId: data.reservationId,
        checkIn,
        checkOut,
        nights,
        totalPrice: data.totalPrice,
        agencyCommission: data.agencyCommission,
        portalCommission: data.portalCommission,
        payout,
        currency: data.currency,
        notes: data.notes || null,
        paid: data.paid ?? false,
        monthKey,
        detailsFilled: true,
      },
    });
  }
  return { status: "ok" };
}

export async function deleteReservationExtensionAction(id: string) {
  await requireRole("ADMIN");
  await prisma.reservationExtension.delete({ where: { id } });
}
