"use server";

// Service charge admin actions:
//   - upsertScheduleAction       — turn the reminder cadence on/off
//   - markInstancePaidAction     — file a payment + proof attachment
//   - markInstanceUnpaidAction   — undo (paid → upcoming)
//   - deleteInstanceAction       — wipe a row (e.g. wrong date)

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { notify, NotificationType } from "@/lib/notify";

const ScheduleSchema = z.object({
  propertyId: z.string().min(1),
  frequencyMonths: z.coerce.number().int().min(1).max(24).default(3),
  reminderDaysBefore: z.coerce.number().int().min(0).max(60).default(7),
  firstDueDate: z.string().min(1),
  active: z.boolean().optional().default(true),
});

export async function upsertServiceChargeScheduleAction(input: {
  propertyId: string;
  frequencyMonths: number;
  reminderDaysBefore: number;
  firstDueDate: string;
  active?: boolean;
}) {
  await requireRole("ADMIN");
  const parsed = ScheduleSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "invalid schedule");
  }
  const v = parsed.data;
  const firstDueDate = new Date(v.firstDueDate);
  if (Number.isNaN(firstDueDate.getTime())) throw new Error("invalid date");

  // Upsert the schedule + make sure there's at least one upcoming
  // instance. The rollover cron job keeps subsequent instances
  // flowing — this initial seed avoids the "no instance" gap when
  // admin first enables the feature.
  await prisma.$transaction(async (tx) => {
    await tx.serviceChargeSchedule.upsert({
      where: { propertyId: v.propertyId },
      create: {
        propertyId: v.propertyId,
        frequencyMonths: v.frequencyMonths,
        reminderDaysBefore: v.reminderDaysBefore,
        firstDueDate,
        active: v.active,
      },
      update: {
        frequencyMonths: v.frequencyMonths,
        reminderDaysBefore: v.reminderDaysBefore,
        firstDueDate,
        active: v.active,
      },
    });
    // Seed an instance for firstDueDate if none exists yet.
    const existing = await tx.serviceChargeInstance.findUnique({
      where: {
        propertyId_dueDate: {
          propertyId: v.propertyId,
          dueDate: firstDueDate,
        },
      },
      select: { id: true },
    });
    if (!existing) {
      await tx.serviceChargeInstance.create({
        data: {
          propertyId: v.propertyId,
          dueDate: firstDueDate,
          status: "UPCOMING",
        },
      });
    }
  });
}

export async function deleteServiceChargeScheduleAction(propertyId: string) {
  await requireRole("ADMIN");
  await prisma.serviceChargeSchedule.delete({ where: { propertyId } });
  // Instances are kept around so the historical record stays intact.
}

const MarkPaidSchema = z.object({
  instanceId: z.string().min(1),
  amount: z.coerce.number().nonnegative().optional(),
  notes: z.string().max(2000).optional().or(z.literal("")),
  // Optional proof — already uploaded to S3 via the presigned PUT.
  proofUrl: z.string().url().optional().or(z.literal("")),
  proofFileName: z.string().max(255).optional().or(z.literal("")),
  proofFileSize: z.coerce.number().int().nonnegative().optional(),
  proofMimeType: z.string().max(120).optional().or(z.literal("")),
});

export async function markServiceChargePaidAction(input: {
  instanceId: string;
  amount?: number;
  notes?: string;
  proofUrl?: string;
  proofFileName?: string;
  proofFileSize?: number;
  proofMimeType?: string;
}) {
  const session = await requireRole("ADMIN");
  const parsed = MarkPaidSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "invalid input");
  }
  const v = parsed.data;
  const instance = await prisma.serviceChargeInstance.findUnique({
    where: { id: v.instanceId },
    include: { property: { select: { id: true, name: true, ownerId: true } } },
  });
  if (!instance) throw new Error("instance not found");

  await prisma.$transaction(async (tx) => {
    // Optional proof — mint a PropertyMedia row tagged
    // SERVICE_CHARGE_PROOF and link to the instance.
    if (v.proofUrl) {
      await tx.propertyMedia.create({
        data: {
          propertyId: instance.property.id,
          kind: "SERVICE_CHARGE_PROOF",
          url: v.proofUrl,
          fileName: v.proofFileName || null,
          fileSize: v.proofFileSize ?? null,
          mimeType: v.proofMimeType || null,
          serviceInstanceId: instance.id,
          uploadedById: session.userId,
        },
      });
    }
    await tx.serviceChargeInstance.update({
      where: { id: v.instanceId },
      data: {
        status: "PAID",
        paidAt: new Date(),
        amount: v.amount ?? null,
        notes: v.notes || null,
      },
    });
  });

  // Notify the owner that the bill is settled — daily reminders stop.
  notify({
    userId: instance.property.ownerId,
    type: NotificationType.SERVICE_CHARGE_PAID,
    title: `Service charge paid · ${instance.property.name}`,
    body: v.amount
      ? `AED ${v.amount.toLocaleString("en-GB", { maximumFractionDigits: 0 })} settled.`
      : `Bill is now settled — no further reminders.`,
    url: "/owner",
    data: {
      propertyId: instance.property.id,
      instanceId: instance.id,
      amount: v.amount,
    },
  }).catch(() => {});
}

export async function markServiceChargeUnpaidAction(instanceId: string) {
  await requireRole("ADMIN");
  await prisma.serviceChargeInstance.update({
    where: { id: instanceId },
    data: { status: "UPCOMING", paidAt: null, amount: null, notes: null },
  });
}

export async function deleteServiceChargeInstanceAction(instanceId: string) {
  await requireRole("ADMIN");
  await prisma.serviceChargeInstance.delete({ where: { id: instanceId } });
}
