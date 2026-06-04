// POST /api/v1/uploads/presign
//
// Body: { scope: string, scopeId?: string, fileName: string, contentType?: string, fileSize?: number }
// Resp: { uploadUrl, publicUrl, key }
//
// Auth: web cookie session (admin) OR bearer JWT (owner). Owners can
// only upload to scopes that involve their own property — admins can
// upload anywhere.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readSession } from "@/lib/auth";
import { readBearerSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { buildS3Key, createPresignedPut } from "@/lib/s3";

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

// Limits where each role may upload. Anything outside this list is
// rejected even for admins so a typo doesn't end up writing to the
// wrong bucket prefix.
const ADMIN_SCOPES = new Set([
  "property-photo",
  "property-document",
  "property-cover",
  "expense-receipt",
  "service-charge-proof",
  "property-event-photo",
  "brand-logo",
]);
const OWNER_SCOPES = new Set<string>([
  // owners don't upload to anywhere yet — future-proofed for profile
  // photos / stay-request attachments.
]);

const Schema = z.object({
  scope: z.string().min(1).max(40),
  scopeId: z.string().max(120).optional(),
  fileName: z.string().min(1).max(255),
  contentType: z.string().max(120).optional(),
  fileSize: z.number().int().positive().max(MAX_BYTES).optional(),
});

export async function POST(req: NextRequest) {
  // Try cookie first (admin), then bearer (owner app).
  const cookieSession = await readSession();
  const bearerSession = cookieSession ? null : await readBearerSession(req);
  const session = cookieSession ?? bearerSession;
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "bad request" },
      { status: 400 },
    );
  }
  const { scope, scopeId, fileName, contentType } = parsed.data;

  const isAdmin = session.role === "ADMIN" || session.role === "SUPERADMIN";
  const isOwner = session.role === "OWNER";

  if (isAdmin) {
    if (!ADMIN_SCOPES.has(scope)) {
      return NextResponse.json(
        { error: `scope not allowed: ${scope}` },
        { status: 400 },
      );
    }
  } else if (isOwner) {
    if (!OWNER_SCOPES.has(scope)) {
      return NextResponse.json(
        { error: "forbidden scope" },
        { status: 403 },
      );
    }
    // If scopeId references a property, ensure the owner owns it.
    if (scopeId) {
      const p = await prisma.property.findUnique({
        where: { id: scopeId },
        select: { ownerId: true },
      });
      if (!p || p.ownerId !== session.userId) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
    }
  } else {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const key = buildS3Key({ scope, scopeId, fileName });
  try {
    const { uploadUrl, publicUrl } = await createPresignedPut({
      key,
      contentType,
    });
    return NextResponse.json({ uploadUrl, publicUrl, key });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "s3 error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
