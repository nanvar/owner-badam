// Token-based auth for the mobile owner app. Mirrors the web's JWT signer
// (so the same secret + payload shape works) but reads from the
// Authorization: Bearer <token> header instead of an httpOnly cookie.
// Does NOT touch the cookie-based web flow.

import { jwtVerify } from "jose";
import type { SessionPayload } from "./auth";

const SECRET = process.env.AUTH_SECRET ?? "dev-secret-change-me";
const KEY = new TextEncoder().encode(SECRET);

export type ApiSession = SessionPayload;

export async function readBearerSession(
  req: Request,
): Promise<ApiSession | null> {
  const auth = req.headers.get("authorization");
  if (!auth) return null;
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
  if (!m) return null;
  try {
    const { payload } = await jwtVerify(m[1], KEY);
    return payload as unknown as ApiSession;
  } catch {
    return null;
  }
}

// Convenience wrapper: returns either an `ApiSession` whose role is OWNER,
// or a `Response` already prepared to send back as the route's reply.
export async function requireOwnerApi(
  req: Request,
): Promise<{ session: ApiSession } | { error: Response }> {
  const session = await readBearerSession(req);
  if (!session) {
    return {
      error: jsonError("unauthorized", 401),
    };
  }
  if (session.role !== "OWNER") {
    return {
      error: jsonError("forbidden", 403),
    };
  }
  return { session };
}

export function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}
