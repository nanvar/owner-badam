"use server";

// After the browser uploads bytes directly to S3 via the presigned
// PUT, it calls these actions to record a PropertyMedia row in the
// DB so the file is discoverable from the property detail UI.

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { deleteS3Object, keyFromPublicUrl } from "@/lib/s3";

const KIND_VALUES = [
  "PHOTO",
  "DOCUMENT",
  "RECEIPT",
  "EVENT_PHOTO",
  "SERVICE_CHARGE_PROOF",
  "COVER",
] as const;

const Schema = z.object({
  propertyId: z.string().min(1),
  kind: z.enum(KIND_VALUES),
  url: z.string().url(),
  fileName: z.string().max(255).optional().or(z.literal("")),
  fileSize: z.coerce.number().int().nonnegative().optional(),
  mimeType: z.string().max(120).optional().or(z.literal("")),
  title: z.string().max(255).optional().or(z.literal("")),
  caption: z.string().max(2000).optional().or(z.literal("")),
  // Optional links for receipts / event photos / service-charge proofs.
  eventId: z.string().optional().or(z.literal("")),
  serviceInstanceId: z.string().optional().or(z.literal("")),
});

export async function recordPropertyMediaAction(input: {
  propertyId: string;
  kind: (typeof KIND_VALUES)[number];
  url: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  title?: string;
  caption?: string;
  eventId?: string;
  serviceInstanceId?: string;
}) {
  const session = await requireRole("ADMIN");
  const parsed = Schema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "invalid media");
  }
  const v = parsed.data;
  const created = await prisma.propertyMedia.create({
    data: {
      propertyId: v.propertyId,
      kind: v.kind,
      url: v.url,
      fileName: v.fileName || null,
      fileSize: v.fileSize ?? null,
      mimeType: v.mimeType || null,
      title: v.title || null,
      caption: v.caption || null,
      eventId: v.eventId || null,
      serviceInstanceId: v.serviceInstanceId || null,
      uploadedById: session.userId,
    },
    select: { id: true, url: true, kind: true, fileName: true },
  });
  return created;
}

export async function deletePropertyMediaAction(id: string) {
  await requireRole("ADMIN");
  // Pull the row so we can clean up S3 too. Best-effort — if S3
  // delete fails the DB row is still removed.
  const row = await prisma.propertyMedia.findUnique({
    where: { id },
    select: { url: true },
  });
  await prisma.propertyMedia.delete({ where: { id } });
  if (row?.url) {
    const key = keyFromPublicUrl(row.url);
    if (key) {
      try {
        await deleteS3Object(key);
      } catch (err) {
        console.warn("[s3] delete failed for", key, err);
      }
    }
  }
}

// Convenience helper for setting a property's cover photo from an
// uploaded PropertyMedia row. Stores the URL onto Property.coverPhotoUrl
// (a fast read path for thumbnails) and tags the media row as COVER.
export async function setPropertyCoverAction(input: {
  propertyId: string;
  mediaId: string;
}) {
  await requireRole("ADMIN");
  const media = await prisma.propertyMedia.findUnique({
    where: { id: input.mediaId },
    select: { url: true, propertyId: true },
  });
  if (!media || media.propertyId !== input.propertyId) {
    throw new Error("media not found");
  }
  await prisma.$transaction([
    prisma.propertyMedia.update({
      where: { id: input.mediaId },
      data: { kind: "COVER" },
    }),
    prisma.property.update({
      where: { id: input.propertyId },
      data: { coverPhotoUrl: media.url },
    }),
  ]);
}
