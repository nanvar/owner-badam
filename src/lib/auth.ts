import { cache } from "react";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import type { Role } from "@/generated/prisma/enums";

const SECRET = process.env.AUTH_SECRET ?? "dev-secret-change-me";
const KEY = new TextEncoder().encode(SECRET);
const COOKIE_NAME = "pms_session";
const SESSION_DAYS = 30;

export type SessionPayload = {
  userId: string;
  email: string;
  name: string | null;
  role: Role;
  locale: string;
};

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hashed: string) {
  return bcrypt.compare(plain, hashed);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(KEY);
}

// Memoised per request so the layout's session decode isn't repeated
// in every nested page/server component.
export const readSession = cache(async (): Promise<SessionPayload | null> => {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, KEY);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
});

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) return { ok: false, error: "Invalid credentials" } as const;
  const valid = await verifyPassword(password, user.password);
  if (!valid) return { ok: false, error: "Invalid credentials" } as const;
  const payload: SessionPayload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    locale: user.locale,
  };
  const token = await signSession(payload);
  await setSessionCookie(token);
  return { ok: true, role: user.role, locale: user.locale } as const;
}

export async function logout() {
  await clearSessionCookie();
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await readSession();
  if (!session) redirect("/en/login");
  return session;
}

export async function requireRole(role: Role): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== role) redirect(`/${session.locale || "en"}/${session.role.toLowerCase()}`);
  return session;
}
