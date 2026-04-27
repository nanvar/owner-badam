"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { motion } from "motion/react";
import { LogOut, Globe, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/actions/auth";
import type { Locale } from "@/i18n/config";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

export function AppShell({
  locale,
  user,
  nav,
  children,
  variant,
  topRight,
  brand,
}: {
  locale: Locale;
  user: { name: string | null; email: string; role: "ADMIN" | "OWNER" };
  nav: NavItem[];
  children: React.ReactNode;
  variant: "admin" | "owner";
  topRight?: React.ReactNode;
  brand?: { name: string; logoUrl: string | null };
}) {
  const pathname = usePathname();
  const [pending, start] = useTransition();

  const switchLocale = (newLocale: Locale) => {
    if (newLocale === locale) return;
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=${60 * 60 * 24 * 365}`;
    const segments = pathname.split("/");
    segments[1] = newLocale;
    window.location.href = segments.join("/");
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-surface)]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link
            href={`/${locale}/${variant}`}
            className="flex items-center gap-2 font-semibold tracking-tight"
          >
            {brand?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brand.logoUrl}
                alt={brand.name}
                className="h-8 w-auto object-contain"
              />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--color-brand)] text-white shadow-sm">
                <Sparkles className="h-4 w-4" />
              </span>
            )}
            <span className="hidden sm:inline">{brand?.name ?? "Badam Owners"}</span>
          </Link>
          <span
            className={cn(
              "hidden rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider sm:inline",
              variant === "admin"
                ? "bg-amber-500/15 text-amber-600"
                : "bg-emerald-500/15 text-emerald-600",
            )}
          >
            {variant}
          </span>
          <nav className="ml-2 hidden flex-1 items-center gap-1 md:flex">
            {nav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-[var(--color-brand-soft)] text-[var(--color-brand)]"
                      : "text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-foreground)]",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {topRight}
            <div className="relative">
              <details className="group">
                <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-xl border border-[var(--color-border)] text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-foreground)]">
                  <Globe className="h-4 w-4" />
                </summary>
                <div className="absolute right-0 top-11 z-10 w-32 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg">
                  {(["en", "ru"] as const).map((l) => (
                    <button
                      key={l}
                      onClick={() => switchLocale(l)}
                      className={cn(
                        "flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-[var(--color-surface-2)]",
                        locale === l && "text-[var(--color-brand)] font-semibold",
                      )}
                    >
                      <span>{l === "en" ? "English" : "Русский"}</span>
                      {locale === l && <span>•</span>}
                    </button>
                  ))}
                </div>
              </details>
            </div>
            <div className="hidden flex-col text-right text-xs leading-tight sm:flex">
              <span className="font-semibold">{user.name ?? user.email}</span>
              <span className="text-[var(--color-muted)]">{user.email}</span>
            </div>
            <form action={() => start(() => logoutAction())}>
              <button
                type="submit"
                disabled={pending}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-border)] text-[var(--color-muted)] transition-colors hover:border-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]"
                aria-label="Log out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-32 pt-4 md:pb-10">
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 px-4 pt-3 md:hidden"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}
      >
        <div
          className="mx-auto flex max-w-md items-stretch gap-1 rounded-[28px] border border-black/[0.06] bg-white p-2 backdrop-blur-xl"
          style={{
            boxShadow:
              "0 24px 48px -12px rgba(15,23,42,0.24), 0 8px 24px -8px rgba(99,102,241,0.28), 0 1px 0 rgba(255,255,255,0.7) inset",
          }}
        >
          {nav.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-center transition-colors",
                  active ? "text-white" : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]",
                )}
                style={{ minHeight: 62 }}
              >
                {active && (
                  <motion.span
                    layoutId="bottom-nav-pill"
                    className="absolute inset-0 -z-10 rounded-2xl"
                    style={{
                      background:
                        "linear-gradient(180deg, #6366f1 0%, #7c3aed 100%)",
                      boxShadow:
                        "0 10px 24px -8px rgba(99,102,241,0.55), 0 4px 10px -2px rgba(124,58,237,0.4), inset 0 1px 0 rgba(255,255,255,0.18)",
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 380,
                      damping: 32,
                      mass: 0.8,
                    }}
                  />
                )}
                <motion.span
                  initial={false}
                  animate={
                    active ? { scale: 1.1, y: -2 } : { scale: 1, y: 0 }
                  }
                  transition={{ type: "spring", stiffness: 420, damping: 30 }}
                  className="grid h-7 w-7 shrink-0 place-items-center"
                >
                  <span
                    className={cn(
                      "[&>svg]:h-5 [&>svg]:w-5",
                      active && "drop-shadow-sm",
                    )}
                  >
                    {item.icon}
                  </span>
                </motion.span>
                <span
                  className="block w-full truncate text-[11px] font-semibold leading-none tracking-tight"
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">{title}</h1>
        {subtitle && (
          <p className="mt-0.5 text-sm text-[var(--color-muted)]">{subtitle}</p>
        )}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

