import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signSession, verifyPassword, type SessionPayload } from "@/lib/auth";
import { jsonError } from "@/lib/api-auth";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("invalid JSON body", 400);
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return jsonError("email and password required", 400);
  }
  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });
  if (!user || !(await verifyPassword(password, user.password))) {
    return jsonError("invalid credentials", 401);
  }
  if (user.blocked) {
    return jsonError("account is blocked", 403);
  }
  // Mobile app is owner-only.
  if (user.role !== "OWNER") {
    return jsonError("only owner accounts can sign in here", 403);
  }
  const payload: SessionPayload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    locale: user.locale,
  };
  const token = await signSession(payload);
  return Response.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      locale: user.locale,
    },
  });
}
