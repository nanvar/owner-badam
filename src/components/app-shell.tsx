"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { motion } from "motion/react";
import {
  LogOut,
  Globe,
  Sparkles,
  Mail,
  Phone,
  MessageCircle,
  Info,
  KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet } from "@/components/ui/sheet";
import { logoutAction } from "@/app/actions/auth";
import { ChangePasswordForm } from "./change-password-form";
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
  user: {
    name: string | null;
    email: string;
    role: "ADMIN" | "OWNER" | "SUPERADMIN";
  };
  nav: NavItem[];
  children: React.ReactNode;
  variant: "admin" | "owner";
  topRight?: React.ReactNode;
  brand?: {
    name: string;
    logoUrl: string | null;
    legalName?: string | null;
    email?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    website?: string | null;
    address?: string | null;
  };
}) {
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [contactOpen, setContactOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const hasContacts = !!(
    brand &&
    (brand.email || brand.phone || brand.whatsapp || brand.website || brand.address)
  );

  const switchLocale = (newLocale: Locale) => {
    if (newLocale === locale) return;
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=${60 * 60 * 24 * 365}`;
    const segments = pathname.split("/");
    segments[1] = newLocale;
    window.location.href = segments.join("/");
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header
        className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-surface)]/90 backdrop-blur-md"
        style={{
          boxShadow:
            "0 8px 24px -16px rgba(15,23,42,0.18), 0 4px 12px -8px rgba(15,23,42,0.08)",
        }}
      >
        <div className="mx-auto grid max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3">
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
          </Link>
          <nav className="hidden items-center justify-center gap-1 md:flex">
            {nav.map((item) => {
              const isRoot =
                item.href === `/${locale}/${variant}`;
              const active = isRoot
                ? pathname === item.href
                : pathname === item.href ||
                  pathname.startsWith(item.href + "/");
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
          <div className="flex items-center gap-2 justify-self-end">
            {topRight}
            <button
              type="button"
              onClick={() => setPasswordOpen(true)}
              className="hidden flex-col text-right text-xs leading-tight transition-colors hover:text-[var(--color-brand)] sm:flex"
              aria-label="Change password"
              title="Change password"
            >
              <span className="font-semibold">{user.name ?? user.email}</span>
              <span className="text-[var(--color-muted)]">{user.email}</span>
            </button>
            <button
              type="button"
              onClick={() => setPasswordOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-border)] text-[var(--color-muted)] transition-colors hover:border-[var(--color-brand)] hover:bg-[var(--color-brand-soft)] hover:text-[var(--color-brand)]"
              aria-label="Change password"
              title="Change password"
            >
              <KeyRound className="h-4 w-4" />
            </button>
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

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-4 md:pb-10">
        {children}
      </main>

      {brand && hasContacts && <BrandFooter brand={brand} />}

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)] bg-white md:hidden"
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)",
          boxShadow:
            "0 -16px 40px -12px rgba(15,23,42,0.22), 0 -6px 16px -8px rgba(15,23,42,0.12), 0 -1px 0 rgba(15,23,42,0.04)",
        }}
      >
        <div className="mx-auto flex max-w-md items-stretch">
          {nav.map((item) => {
            const isRoot = item.href === `/${locale}/${variant}`;
            const active = isRoot
              ? pathname === item.href
              : pathname === item.href ||
                pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group relative flex flex-1 flex-col items-center justify-center gap-1.5 px-1 pt-2.5 pb-2"
              >
                <span className="relative grid h-9 w-[60px] place-items-center">
                  {active && (
                    <motion.span
                      layoutId="bottom-nav-pill"
                      className="absolute inset-0 rounded-full"
                      style={{ background: "rgba(79,138,111,0.16)" }}
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 34,
                        mass: 0.7,
                      }}
                    />
                  )}
                  <motion.span
                    initial={false}
                    animate={{ scale: active ? 1.05 : 1 }}
                    transition={{ type: "spring", stiffness: 420, damping: 28 }}
                    className={cn(
                      "relative grid h-6 w-6 place-items-center transition-colors duration-200 [&>svg]:h-[22px] [&>svg]:w-[22px]",
                      active ? "text-[var(--color-brand)]" : "text-[#9ca3af]",
                    )}
                  >
                    {item.icon}
                  </motion.span>
                </span>
                <span
                  className={cn(
                    "block w-full truncate text-center text-[11px] leading-none tracking-tight transition-colors duration-200",
                    active
                      ? "font-semibold text-[var(--color-brand)]"
                      : "font-medium text-[#9ca3af]",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
          {brand && hasContacts && (
            <button
              type="button"
              onClick={() => setContactOpen(true)}
              className="group relative flex flex-1 flex-col items-center justify-center gap-1.5 px-1 pt-2.5 pb-2"
              aria-label="Contact"
            >
              <span className="relative grid h-9 w-[60px] place-items-center">
                <motion.span
                  initial={false}
                  animate={{ scale: contactOpen ? 1.05 : 1 }}
                  transition={{ type: "spring", stiffness: 420, damping: 28 }}
                  className={cn(
                    "relative grid h-6 w-6 place-items-center transition-colors duration-200 [&>svg]:h-[22px] [&>svg]:w-[22px]",
                    contactOpen
                      ? "text-[var(--color-brand)]"
                      : "text-[#9ca3af]",
                  )}
                >
                  <Info />
                </motion.span>
              </span>
              <span
                className={cn(
                  "block w-full truncate text-center text-[11px] leading-none tracking-tight transition-colors duration-200",
                  contactOpen
                    ? "font-semibold text-[var(--color-brand)]"
                    : "font-medium text-[#9ca3af]",
                )}
              >
                Contact
              </span>
            </button>
          )}
        </div>
      </nav>

      {brand && hasContacts && (
        <Sheet
          open={contactOpen}
          onClose={() => setContactOpen(false)}
          side="bottom"
          title={brand.legalName || brand.name}
          description={brand.address ?? undefined}
        >
          <ContactList brand={brand} />
        </Sheet>
      )}

      <Sheet
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        side="bottom"
        title="Change password"
        description={user.email}
      >
        <ChangePasswordForm onDone={() => setPasswordOpen(false)} />
      </Sheet>
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

function ContactList({
  brand,
}: {
  brand: {
    name: string;
    logoUrl: string | null;
    legalName?: string | null;
    email?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    website?: string | null;
    address?: string | null;
  };
}) {
  const websiteHref = brand.website
    ? brand.website.startsWith("http")
      ? brand.website
      : `https://${brand.website}`
    : null;
  const websiteLabel = brand.website
    ? brand.website.replace(/^https?:\/\//, "")
    : null;
  const whatsappHref = brand.whatsapp
    ? `https://wa.me/${brand.whatsapp.replace(/[^0-9]/g, "")}`
    : null;

  const Row = ({
    href,
    icon,
    label,
    value,
    accent,
  }: {
    href: string;
    icon: React.ReactNode;
    label: string;
    value: string;
    accent: string;
  }) => (
    <a
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 transition-colors hover:bg-[var(--color-surface-2)]"
    >
      <span
        className={cn(
          "grid h-10 w-10 place-items-center rounded-xl",
          accent,
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          {label}
        </div>
        <div className="mt-0.5 truncate text-sm font-semibold text-[var(--color-foreground)]">
          {value}
        </div>
      </div>
    </a>
  );

  return (
    <div className="space-y-2 pb-2">
      {brand.email && (
        <Row
          href={`mailto:${brand.email}`}
          icon={<Mail className="h-5 w-5 text-emerald-600" />}
          label="Email"
          value={brand.email}
          accent="bg-emerald-500/10"
        />
      )}
      {brand.phone && (
        <Row
          href={`tel:${brand.phone.replace(/[^+\d]/g, "")}`}
          icon={<Phone className="h-5 w-5 text-sky-600" />}
          label="Phone"
          value={brand.phone}
          accent="bg-sky-500/10"
        />
      )}
      {whatsappHref && brand.whatsapp && (
        <Row
          href={whatsappHref}
          icon={<MessageCircle className="h-5 w-5 text-emerald-600" />}
          label="WhatsApp"
          value={brand.whatsapp}
          accent="bg-emerald-500/10"
        />
      )}
      {websiteHref && websiteLabel && (
        <Row
          href={websiteHref}
          icon={<Globe className="h-5 w-5 text-indigo-600" />}
          label="Website"
          value={websiteLabel}
          accent="bg-indigo-500/10"
        />
      )}
    </div>
  );
}

function BrandFooter({
  brand,
}: {
  brand: {
    name: string;
    logoUrl: string | null;
    legalName?: string | null;
    email?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    website?: string | null;
    address?: string | null;
  };
}) {
  const websiteHref = brand.website
    ? brand.website.startsWith("http")
      ? brand.website
      : `https://${brand.website}`
    : null;
  const websiteLabel = brand.website
    ? brand.website.replace(/^https?:\/\//, "")
    : null;
  const whatsappHref = brand.whatsapp
    ? `https://wa.me/${brand.whatsapp.replace(/[^0-9]/g, "")}`
    : null;
  return (
    <footer
      className="hidden border-t border-[var(--color-border)] bg-white md:block"
      style={{
        boxShadow:
          "0 -10px 28px -18px rgba(15,23,42,0.18), 0 -3px 10px -6px rgba(15,23,42,0.08)",
      }}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-sm">
        <div className="font-semibold text-[var(--color-foreground)]">
          {brand.legalName || brand.name}
          {brand.address && (
            <span className="ml-2 font-normal text-[var(--color-foreground)]/70">
              · {brand.address}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[var(--color-foreground)]/80">
          {brand.email && (
            <a
              href={`mailto:${brand.email}`}
              className="flex items-center gap-1.5 font-medium hover:text-[var(--color-brand)]"
            >
              <Mail className="h-4 w-4" />
              {brand.email}
            </a>
          )}
          {brand.phone && (
            <a
              href={`tel:${brand.phone.replace(/[^+\d]/g, "")}`}
              className="flex items-center gap-1.5 font-medium hover:text-[var(--color-brand)]"
            >
              <Phone className="h-4 w-4" />
              {brand.phone}
            </a>
          )}
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 font-medium hover:text-emerald-500"
            >
              <MessageCircle className="h-4 w-4" />
              {brand.whatsapp}
            </a>
          )}
          {websiteHref && websiteLabel && (
            <a
              href={websiteHref}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 font-medium hover:text-[var(--color-brand)]"
            >
              <Globe className="h-4 w-4" />
              {websiteLabel}
            </a>
          )}
        </div>
      </div>
    </footer>
  );
}
