import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { defaultLocale, locales } from "@/i18n/config";

const SECRET = process.env.AUTH_SECRET ?? "dev-secret-change-me";
const KEY = new TextEncoder().encode(SECRET);

const PUBLIC_PATHS = new Set(["login"]);

function pickLocale(req: NextRequest): string {
  const cookieLocale = req.cookies.get("NEXT_LOCALE")?.value;
  if (cookieLocale && (locales as readonly string[]).includes(cookieLocale)) {
    return cookieLocale;
  }
  const accept = req.headers.get("accept-language") || "";
  for (const part of accept.split(",")) {
    const lang = part.split(";")[0].trim().toLowerCase().slice(0, 2);
    if ((locales as readonly string[]).includes(lang)) return lang;
  }
  return defaultLocale;
}

async function readSessionFromRequest(req: NextRequest) {
  const token = req.cookies.get("pms_session")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, KEY);
    return payload as { userId: string; role: "ADMIN" | "OWNER"; locale: string };
  } catch {
    return null;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];
  const hasLocale = first && (locales as readonly string[]).includes(first);

  if (!hasLocale) {
    const locale = pickLocale(req);
    const newUrl = req.nextUrl.clone();
    newUrl.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(newUrl);
  }

  const locale = first as string;
  const subPath = segments[1] ?? "";
  const session = await readSessionFromRequest(req);

  if (PUBLIC_PATHS.has(subPath)) {
    if (session) {
      const dest = req.nextUrl.clone();
      dest.pathname = `/${locale}/${session.role.toLowerCase()}`;
      return NextResponse.redirect(dest);
    }
    return NextResponse.next();
  }

  if (segments.length === 1) {
    const dest = req.nextUrl.clone();
    dest.pathname = session ? `/${locale}/${session.role.toLowerCase()}` : `/${locale}/login`;
    return NextResponse.redirect(dest);
  }

  if (subPath === "admin") {
    if (!session) {
      const dest = req.nextUrl.clone();
      dest.pathname = `/${locale}/login`;
      return NextResponse.redirect(dest);
    }
    if (session.role !== "ADMIN") {
      const dest = req.nextUrl.clone();
      dest.pathname = `/${locale}/owner`;
      return NextResponse.redirect(dest);
    }
  }

  if (subPath === "owner") {
    if (!session) {
      const dest = req.nextUrl.clone();
      dest.pathname = `/${locale}/login`;
      return NextResponse.redirect(dest);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
