import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { Compass, Sparkles } from "lucide-react";
import {
  defaultLocale,
  isLocale,
  type Locale,
} from "@/i18n/config";
import { readSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Card } from "@/components/ui/card";

// Renders for any unmatched route under [locale] AND for `notFound()` calls
// from inside this segment. Next.js doesn't pass route params here, so we
// resolve the locale from the NEXT_LOCALE cookie that the proxy sets.
export default async function NotFoundPage() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  const locale: Locale = isLocale(cookieLocale ?? "")
    ? (cookieLocale as Locale)
    : defaultLocale;

  const [t, session, settings] = await Promise.all([
    getTranslations({ locale, namespace: "notFound" }),
    readSession(),
    getSettings(),
  ]);

  // Pick the right home destination so signed-in users land in their
  // dashboard, not on the login screen.
  const home =
    session?.role === "SUPERADMIN"
      ? `/${locale}/admin/company`
      : session?.role === "ADMIN"
        ? `/${locale}/admin`
        : session?.role === "OWNER"
          ? `/${locale}/owner`
          : `/${locale}/login`;

  return (
    <div
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-5 py-10"
      style={{
        background:
          "linear-gradient(160deg, #4f8a6f 0%, #3d6f57 45%, #f3f7f4 75%, #ffffff 100%)",
      }}
    >
      <div
        className="pointer-events-none absolute -right-20 top-10 h-72 w-72 rounded-full opacity-40 blur-3xl"
        style={{ background: "rgba(168,200,182,0.6)" }}
      />
      <div
        className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full opacity-50 blur-3xl"
        style={{ background: "rgba(255,255,255,0.5)" }}
      />
      <div className="relative w-full max-w-md animate-fade-in">
        <Card className="border-[var(--color-border)] p-8 text-center shadow-2xl shadow-emerald-900/20 ring-1 ring-black/5">
          <div className="flex flex-col items-center">
            {settings.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={settings.logoUrl}
                alt={settings.brandName}
                className="h-12 w-auto object-contain"
              />
            ) : (
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--color-brand)] text-white shadow-lg shadow-emerald-700/25">
                <Sparkles className="h-6 w-6" />
              </span>
            )}
            <div className="mt-6 grid h-16 w-16 place-items-center rounded-3xl bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
              <Compass className="h-8 w-8" />
            </div>
            <div className="mt-4 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--color-muted)]">
              404
            </div>
            <h1 className="mt-2 text-balance text-2xl font-bold tracking-tight">
              {t("title")}
            </h1>
            <p className="mt-3 text-sm text-[var(--color-muted)]">
              {t("description")}
            </p>
            <Link
              href={home}
              className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--color-brand)] px-5 text-sm font-semibold text-white shadow shadow-emerald-700/25 transition-transform hover:scale-[1.02]"
            >
              {t("backHome")}
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
