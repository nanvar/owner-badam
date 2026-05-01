import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { defaultLocale, locales } from "@/i18n/config";

const SECRET = process.env.AUTH_SECRET ?? "dev-secret-change-me";
const KEY = new TextEncoder().encode(SECRET);

// Routes anyone (auth or not) can browse. Anything outside these and not
// under /admin or /owner falls through with no auth gate, which means the
// public homepage `/${locale}/` and property pages `/${locale}/property/*`
// are reachable without a session.
const PUBLIC_PATHS = new Set(["login"]);
const PUBLIC_PREFIXES = new Set(["property"]);

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

type ProxyRole = "ADMIN" | "OWNER" | "SUPERADMIN";

async function readSessionFromRequest(req: NextRequest) {
  const token = req.cookies.get("pms_session")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, KEY);
    return payload as { userId: string; role: ProxyRole; locale: string };
  } catch {
    return null;
  }
}

// Where each role lands when they hit `/${locale}` (root) or login while
// already authenticated. SUPERADMIN goes to the company dashboard, which
// lives under /admin so they share the same shell as ADMIN.
function landingPath(role: ProxyRole): string {
  if (role === "SUPERADMIN") return "admin/company";
  return role.toLowerCase();
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

  // Login: redirect signed-in users to their dashboard (don't show login
  // form to someone already authenticated).
  if (PUBLIC_PATHS.has(subPath)) {
    if (session) {
      const dest = req.nextUrl.clone();
      dest.pathname = `/${locale}/${landingPath(session.role)}`;
      return NextResponse.redirect(dest);
    }
    return NextResponse.next();
  }

  // Public homepage `/${locale}` — accessible to everyone (signed in or not).
  if (segments.length === 1) {
    return NextResponse.next();
  }

  // Public sub-trees (property pages, etc.) — no auth required.
  if (PUBLIC_PREFIXES.has(subPath)) {
    return NextResponse.next();
  }

  if (subPath === "admin") {
    if (!session) {
      const dest = req.nextUrl.clone();
      dest.pathname = `/${locale}/login`;
      return NextResponse.redirect(dest);
    }
    // SUPERADMIN ⊃ ADMIN — both share the /admin shell.
    if (session.role !== "ADMIN" && session.role !== "SUPERADMIN") {
      const dest = req.nextUrl.clone();
      dest.pathname = `/${locale}/${landingPath(session.role)}`;
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
  matcher: ["/", "/((?!api|_next|.*\\..*).*)"],
};
