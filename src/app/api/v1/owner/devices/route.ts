import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwnerApi, jsonError } from "@/lib/api-auth";

const RegisterBody = z.object({
  token: z.string().min(8).max(255),
  platform: z.enum(["ios", "android"]).optional(),
});

// POST /devices — register or refresh a push token for the signed-in owner.
// Token is unique across all users (Expo guarantees), so we upsert by token
// and re-bind it to the current user (handy when a phone is handed off).
export async function POST(req: Request) {
  const auth = await requireOwnerApi(req);
  if ("error" in auth) return auth.error;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("invalid JSON", 400);
  }
  const parsed = RegisterBody.safeParse(raw);
  if (!parsed.success) {
    return jsonError("token required", 400);
  }
  const { token, platform } = parsed.data;
  await prisma.ownerDevice.upsert({
    where: { token },
    create: {
      token,
      platform: platform ?? null,
      userId: auth.session.userId,
    },
    update: {
      userId: auth.session.userId,
      platform: platform ?? null,
    },
  });
  return Response.json({ ok: true });
}

// DELETE /devices?token=... — unregister on logout / disable toggle.
export async function DELETE(req: Request) {
  const auth = await requireOwnerApi(req);
  if ("error" in auth) return auth.error;
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return jsonError("token query param required", 400);
  await prisma.ownerDevice.deleteMany({
    where: { token, userId: auth.session.userId },
  });
  return Response.json({ ok: true });
}
