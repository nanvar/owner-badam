"use server";

// CRUD for PropertyEvent rows — the "what happened on this property"
// timeline (renovations, inspections, condition notes, furniture
// changes…). Each event can attach already-uploaded PropertyMedia
// rows via the optional `photoIds` field.

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { notify, NotificationType } from "@/lib/notify";

const Schema = z.object({
  id: z.string().optional(),
  propertyId: z.string().min(1),
  kind: z.string().min(1).max(40),
  title: z.string().min(1).max(255),
  description: z.string().max(4000).optional().or(z.literal("")),
  happenedAt: z.string().min(1),
  // Already-uploaded media rows that should be linked to this event.
  photoIds: z.array(z.string().min(1)).optional(),
});

export async function upsertPropertyEventAction(input: {
  id?: string;
  propertyId: string;
  kind: string;
  title: string;
  description?: string;
  happenedAt: string;
  photoIds?: string[];
}) {
  const session = await requireRole("ADMIN");
  const parsed = Schema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "invalid event");
  }
  const v = parsed.data;
  const happenedAt = new Date(v.happenedAt);
  if (Number.isNaN(happenedAt.getTime())) {
    throw new Error("invalid date");
  }

  const data = {
    propertyId: v.propertyId,
    kind: v.kind,
    title: v.title,
    description: v.description || null,
    happenedAt,
    createdById: session.userId,
  };

  const result = await prisma.$transaction(async (tx) => {
    const ev = v.id
      ? await tx.propertyEvent.update({ where: { id: v.id }, data })
      : await tx.propertyEvent.create({ data });
    if (v.photoIds && v.photoIds.length) {
      // Re-link only photos belonging to this property — defence
      // against tampered ids.
      await tx.propertyMedia.updateMany({
        where: {
          id: { in: v.photoIds },
          propertyId: v.propertyId,
        },
        data: { eventId: ev.id, kind: "EVENT_PHOTO" },
      });
    }
    return ev;
  });

  // Notify the owner — new event = something noteworthy happened on
  // their property.
  if (!v.id) {
    const property = await prisma.property.findUnique({
      where: { id: v.propertyId },
      select: { ownerId: true, name: true },
    });
    if (property) {
      notify({
        userId: property.ownerId,
        type: NotificationType.PROPERTY_EVENT,
        title: `${v.title} · ${property.name}`,
        body: v.description ? v.description.slice(0, 140) : undefined,
        url: "/owner",
        data: { propertyId: v.propertyId, eventId: result.id, kind: v.kind },
      }).catch(() => {});
    }
  }

  return { id: result.id };
}

export async function deletePropertyEventAction(id: string) {
  await requireRole("ADMIN");
  await prisma.propertyEvent.delete({ where: { id } });
}
