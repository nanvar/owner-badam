"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

const ReservationSchema = z.object({
  id: z.string().min(1),
  guestName: z.string().max(120).optional().or(z.literal("")),
  guestPhone: z.string().max(60).optional().or(z.literal("")),
  guestEmail: z.string().max(120).optional().or(z.literal("")),
  numGuests: z.coerce.number().int().min(0).optional(),
  pricePerNight: z.coerce.number().nonnegative(),
  cleaningFee: z.coerce.number().nonnegative().default(0),
  agencyCommission: z.coerce.number().nonnegative().default(0),
  portalCommission: z.coerce.number().nonnegative().default(0),
  serviceFee: z.coerce.number().nonnegative().default(0),
  taxes: z.coerce.number().nonnegative().default(0),
  totalPrice: z.coerce.number().nonnegative(),
  payout: z.coerce.number().nonnegative(),
  currency: z.string().default("AED"),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export type ReservationState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "error"; message: string };

export async function updateReservationAction(
  _prev: ReservationState | undefined,
  formData: FormData,
): Promise<ReservationState> {
  await requireRole("ADMIN");
  const parsed = ReservationSchema.safeParse({
    id: formData.get("id"),
    guestName: formData.get("guestName") || "",
    guestPhone: formData.get("guestPhone") || "",
    guestEmail: formData.get("guestEmail") || "",
    numGuests: formData.get("numGuests") || 0,
    pricePerNight: formData.get("pricePerNight") || 0,
    cleaningFee: formData.get("cleaningFee") || 0,
    agencyCommission: formData.get("agencyCommission") || 0,
    portalCommission: formData.get("portalCommission") || 0,
    serviceFee: formData.get("serviceFee") || 0,
    taxes: formData.get("taxes") || 0,
    totalPrice: formData.get("totalPrice") || 0,
    payout: formData.get("payout") || 0,
    currency: (formData.get("currency") as string) || "AED",
    notes: formData.get("notes") || "",
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;
  await prisma.reservation.update({
    where: { id: data.id },
    data: {
      guestName: data.guestName || null,
      guestPhone: data.guestPhone || null,
      guestEmail: data.guestEmail || null,
      numGuests: data.numGuests ?? null,
      pricePerNight: data.pricePerNight,
      cleaningFee: data.cleaningFee,
      agencyCommission: data.agencyCommission,
      portalCommission: data.portalCommission,
      serviceFee: data.serviceFee,
      taxes: data.taxes,
      totalPrice: data.totalPrice,
      payout: data.payout,
      currency: data.currency,
      notes: data.notes || null,
      detailsFilled: true,
    },
  });
  return { status: "ok" };
}

export async function deleteReservationAction(id: string) {
  await requireRole("ADMIN");
  await prisma.reservation.delete({ where: { id } });
}
