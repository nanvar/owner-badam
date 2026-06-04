"use server";

// Owner stay-quota + reservation-request actions.
//
// Admin side: configure the quota (daysPerYear, yearStart) and
// approve/reject incoming requests.
//
// Owner side: file a new request, cancel a pending one. Validations
// enforce the quota before persisting.

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { validateAgainstQuota } from "@/lib/stay-quota";
import { notify, NotificationType } from "@/lib/notify";

// ============================================================
// Admin: quota config
// ============================================================
const QuotaSchema = z.object({
  propertyId: z.string().min(1),
  daysPerYear: z.coerce.number().int().min(0).max(366).default(0),
  yearStartMonth: z.coerce.number().int().min(1).max(12).default(1),
  yearStartDay: z.coerce.number().int().min(1).max(31).default(1),
});

export async function upsertOwnerStayQuotaAction(input: {
  propertyId: string;
  daysPerYear: number;
  yearStartMonth: number;
  yearStartDay: number;
}) {
  await requireRole("ADMIN");
  const parsed = QuotaSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "invalid quota");
  }
  const v = parsed.data;
  await prisma.ownerStayQuota.upsert({
    where: { propertyId: v.propertyId },
    create: v,
    update: {
      daysPerYear: v.daysPerYear,
      yearStartMonth: v.yearStartMonth,
      yearStartDay: v.yearStartDay,
    },
  });
}

export async function deleteOwnerStayQuotaAction(propertyId: string) {
  await requireRole("ADMIN");
  await prisma.ownerStayQuota.delete({ where: { propertyId } });
}

// ============================================================
// Admin: approve / reject / undo
// ============================================================
const DecideSchema = z.object({
  requestId: z.string().min(1),
  note: z.string().max(500).optional().or(z.literal("")),
});

export async function approveReservationRequestAction(input: {
  requestId: string;
  note?: string;
}) {
  const session = await requireRole("ADMIN");
  const parsed = DecideSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "invalid input");
  }
  const req = await prisma.ownerReservationRequest.findUnique({
    where: { id: parsed.data.requestId },
    include: { property: { select: { name: true } } },
  });
  if (!req) throw new Error("request not found");
  if (req.status === "APPROVED") return;
  // Re-validate against quota in case other requests landed
  // simultaneously — we don't want approval to silently overflow.
  const err = await validateAgainstQuota({
    propertyId: req.propertyId,
    checkIn: req.checkIn,
    checkOut: req.checkOut,
    ignoreRequestId: req.id,
  });
  if (err) throw new Error(`Cannot approve: ${err}`);
  await prisma.ownerReservationRequest.update({
    where: { id: req.id },
    data: {
      status: "APPROVED",
      decidedAt: new Date(),
      decidedById: session.userId,
      decisionNote: parsed.data.note || null,
    },
  });
  notify({
    userId: req.ownerId,
    type: NotificationType.STAY_REQUEST_APPROVED,
    title: `Stay request approved · ${req.property.name}`,
    body: `${req.checkIn.toISOString().slice(0, 10)} → ${req.checkOut.toISOString().slice(0, 10)} (${req.nights} night${req.nights === 1 ? "" : "s"}) confirmed.`,
    url: "/owner",
    data: { requestId: req.id, propertyId: req.propertyId },
  }).catch(() => {});
}

export async function rejectReservationRequestAction(input: {
  requestId: string;
  note?: string;
}) {
  const session = await requireRole("ADMIN");
  const parsed = DecideSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "invalid input");
  }
  const req = await prisma.ownerReservationRequest.findUnique({
    where: { id: parsed.data.requestId },
    include: { property: { select: { name: true } } },
  });
  if (!req) throw new Error("request not found");
  await prisma.ownerReservationRequest.update({
    where: { id: req.id },
    data: {
      status: "REJECTED",
      decidedAt: new Date(),
      decidedById: session.userId,
      decisionNote: parsed.data.note || null,
    },
  });
  notify({
    userId: req.ownerId,
    type: NotificationType.STAY_REQUEST_REJECTED,
    title: `Stay request rejected · ${req.property.name}`,
    body: parsed.data.note?.trim()
      ? parsed.data.note.slice(0, 140)
      : `${req.checkIn.toISOString().slice(0, 10)} → ${req.checkOut.toISOString().slice(0, 10)} was rejected.`,
    url: "/owner",
    data: { requestId: req.id, propertyId: req.propertyId },
  }).catch(() => {});
}

// ============================================================
// Owner: create / cancel
// ============================================================
const CreateSchema = z.object({
  propertyId: z.string().min(1),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export async function createOwnerReservationRequestAction(input: {
  propertyId: string;
  checkIn: string;
  checkOut: string;
  notes?: string;
}) {
  const session = await requireRole("OWNER");
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "invalid input");
  }
  const v = parsed.data;
  // Confirm the owner actually owns this property.
  const prop = await prisma.property.findUnique({
    where: { id: v.propertyId },
    select: { id: true, name: true, ownerId: true },
  });
  if (!prop || prop.ownerId !== session.userId) {
    throw new Error("Property not found.");
  }
  const checkIn = new Date(v.checkIn);
  const checkOut = new Date(v.checkOut);
  const err = await validateAgainstQuota({
    propertyId: v.propertyId,
    checkIn,
    checkOut,
  });
  if (err) throw new Error(err);
  const nights = Math.round(
    (checkOut.getTime() - checkIn.getTime()) / 86400000,
  );
  const created = await prisma.ownerReservationRequest.create({
    data: {
      propertyId: v.propertyId,
      ownerId: session.userId,
      checkIn,
      checkOut,
      nights,
      notes: v.notes || null,
      status: "PENDING",
    },
  });
  return { id: created.id };
}

export async function cancelOwnerReservationRequestAction(requestId: string) {
  const session = await requireRole("OWNER");
  const req = await prisma.ownerReservationRequest.findUnique({
    where: { id: requestId },
    select: { ownerId: true, status: true },
  });
  if (!req || req.ownerId !== session.userId) throw new Error("not found");
  if (req.status !== "PENDING") {
    throw new Error("Only pending requests can be cancelled here.");
  }
  await prisma.ownerReservationRequest.update({
    where: { id: requestId },
    data: { status: "CANCELLED" },
  });
}
