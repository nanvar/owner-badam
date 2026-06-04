"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { monthKeyFor } from "@/lib/utils";
import { notify, NotificationType } from "@/lib/notify";

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
  paid: z.coerce.boolean().optional(),
  monthKey: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional()
    .or(z.literal("")),
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
    paid: formData.get("paid") === "on" || formData.get("paid") === "true",
    monthKey: (formData.get("monthKey") as string | null) ?? "",
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;
  // Form sends the explicit billing month; if omitted (older clients),
  // fall back to the reservation's checkIn month.
  // Pull the existing row so we can detect the unpaid→paid transition
  // and send a one-shot RESERVATION_PAID notification.
  const existing = await prisma.reservation.findUnique({
    where: { id: data.id },
    select: {
      checkIn: true,
      paid: true,
      property: { select: { ownerId: true, name: true } },
    },
  });
  let monthKey: string | null = data.monthKey || null;
  if (!monthKey) {
    monthKey = existing ? monthKeyFor(existing.checkIn) : null;
  }
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
      upcoming: false,
      paid: data.paid ?? false,
      monthKey,
      detailsFilled: true,
    },
  });
  // Notify when the reservation just became paid (false → true).
  if (existing && !existing.paid && data.paid) {
    notify({
      userId: existing.property.ownerId,
      type: NotificationType.RESERVATION_PAID,
      title: `Booking paid · ${existing.property.name}`,
      body: `Payout AED ${data.payout.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`,
      url: "/owner/calendar",
      data: { reservationId: data.id, payout: data.payout },
    }).catch(() => {});
  }
  return { status: "ok" };
}

export async function deleteReservationAction(id: string) {
  await requireRole("ADMIN");
  await prisma.reservation.delete({ where: { id } });
}

// Manual reservation entry — used for properties that aren't on Airbnb so
// reports still capture the income. Mirrors the iCal sync writer's shape but
// the admin types every field by hand (including dates).
const CompanyReservationSchema = z.object({
  propertyId: z.string().min(1),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  guestName: z.string().max(120).optional().or(z.literal("")),
  guestPhone: z.string().max(60).optional().or(z.literal("")),
  guestEmail: z.string().max(120).optional().or(z.literal("")),
  numGuests: z.coerce.number().int().min(0).optional(),
  totalPrice: z.coerce.number().nonnegative(),
  agencyCommission: z.coerce.number().nonnegative().default(0),
  portalCommission: z.coerce.number().nonnegative().default(0),
  cleaningFee: z.coerce.number().nonnegative().default(0),
  serviceFee: z.coerce.number().nonnegative().default(0),
  taxes: z.coerce.number().nonnegative().default(0),
  currency: z.string().default("AED"),
  notes: z.string().max(2000).optional().or(z.literal("")),
  paid: z.coerce.boolean().optional(),
  monthKey: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional()
    .or(z.literal("")),
});

export async function createCompanyReservationAction(
  _prev: ReservationState | undefined,
  formData: FormData,
): Promise<ReservationState> {
  await requireRole("ADMIN");
  const parsed = CompanyReservationSchema.safeParse({
    propertyId: formData.get("propertyId"),
    checkIn: formData.get("checkIn"),
    checkOut: formData.get("checkOut"),
    guestName: formData.get("guestName") || "",
    guestPhone: formData.get("guestPhone") || "",
    guestEmail: formData.get("guestEmail") || "",
    numGuests: formData.get("numGuests") || 0,
    totalPrice: formData.get("totalPrice") || 0,
    agencyCommission: formData.get("agencyCommission") || 0,
    portalCommission: formData.get("portalCommission") || 0,
    cleaningFee: formData.get("cleaningFee") || 0,
    serviceFee: formData.get("serviceFee") || 0,
    taxes: formData.get("taxes") || 0,
    currency: (formData.get("currency") as string) || "AED",
    notes: formData.get("notes") || "",
    paid: formData.get("paid") === "on" || formData.get("paid") === "true",
    monthKey: (formData.get("monthKey") as string | null) ?? "",
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" };
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
    Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const pricePerNight = data.totalPrice / nights;
  const payout = Math.max(
    0,
    data.totalPrice - data.agencyCommission - data.portalCommission,
  );

  const created = await prisma.reservation.create({
    data: {
      propertyId: data.propertyId,
      // Unique on (propertyId, externalId) — generate a stable id so manual
      // entries never collide with Airbnb UIDs.
      externalId: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      source: "company",
      status: "CONFIRMED",
      guestName: data.guestName || null,
      guestPhone: data.guestPhone || null,
      guestEmail: data.guestEmail || null,
      numGuests: data.numGuests ?? null,
      checkIn,
      checkOut,
      nights,
      pricePerNight,
      cleaningFee: data.cleaningFee,
      agencyCommission: data.agencyCommission,
      portalCommission: data.portalCommission,
      serviceFee: data.serviceFee,
      taxes: data.taxes,
      totalPrice: data.totalPrice,
      payout,
      currency: data.currency,
      notes: data.notes || null,
      upcoming: false,
      paid: data.paid ?? false,
      monthKey: data.monthKey || monthKeyFor(checkIn),
      detailsFilled: true,
    },
    include: { property: { select: { ownerId: true, name: true } } },
  });
  notify({
    userId: created.property.ownerId,
    type: NotificationType.NEW_RESERVATION,
    title: `New booking · ${created.property.name}`,
    body: `${data.guestName || "Guest"} · ${checkIn.toISOString().slice(0, 10)} → ${checkOut.toISOString().slice(0, 10)} (${nights} night${nights === 1 ? "" : "s"})`,
    url: "/owner/calendar",
    data: {
      reservationId: created.id,
      propertyId: data.propertyId,
      checkIn: checkIn.toISOString(),
      checkOut: checkOut.toISOString(),
      nights,
      totalPrice: data.totalPrice,
    },
  }).catch(() => {});
  return { status: "ok" };
}
