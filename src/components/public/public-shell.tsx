import Link from "next/link";
import {
  Mail,
  Phone,
  MessageCircle,
  Globe,
  Sparkles,
  ExternalLink,
  LayoutDashboard,
} from "lucide-react";
import type { Locale } from "@/i18n/config";

type Brand = {
  name: string;
  legalName: string;
  tagline: string;
  logoUrl: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
  about: string | null;
};

type SessionInfo = {
  signedIn: boolean;
  role: "ADMIN" | "OWNER" | "SUPERADMIN" | null;
  name: string | null;
} | null;

export function PublicShell({
  locale,
  brand,
  session,
  children,
}: {
  locale: Locale;
  brand: Brand;
  session: SessionInfo;
  children: React.ReactNode;
}) {
  const dashboardHref =
    session?.role === "OWNER"
      ? `/${locale}/owner`
      : session?.role === "SUPERADMIN"
        ? `/${locale}/admin/company`
        : session?.role === "ADMIN"
          ? `/${locale}/admin`
          : null;

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header
        className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-white/85 backdrop-blur-md"
        style={{
          boxShadow:
            "0 8px 24px -16px rgba(15,23,42,0.18), 0 4px 12px -8px rgba(15,23,42,0.08)",
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link
            href={`/${locale}`}
            className="flex items-center gap-2 font-semibold tracking-tight"
          >
            {brand.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brand.logoUrl}
                alt={brand.name}
                className="h-9 w-auto object-contain"
              />
            ) : (
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--color-brand)] text-white shadow-sm">
                <Sparkles className="h-5 w-5" />
              </span>
            )}
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-[var(--color-foreground)]/85 md:flex">
            <Link
              href={`/${locale}#properties`}
              className="hover:text-[var(--color-brand)]"
            >
              Properties
            </Link>
            <Link
              href={`/${locale}#about`}
              className="hover:text-[var(--color-brand)]"
            >
              About
            </Link>
            <Link
              href={`/${locale}#contact`}
              className="hover:text-[var(--color-brand)]"
            >
              Contact
            </Link>
          </nav>
          {dashboardHref ? (
            <Link
              href={dashboardHref}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--color-brand)] px-4 text-sm font-semibold text-white shadow shadow-emerald-700/25 transition-transform hover:scale-[1.02]"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
          ) : (
            <Link
              href={`/${locale}/login`}
              className="inline-flex h-10 items-center gap-2 rounded-xl border-2 border-[var(--color-border)] bg-white px-4 text-sm font-semibold transition-colors hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
            >
              Sign in
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer
        id="contact"
        className="mt-12 border-t border-[var(--color-border)] bg-[var(--color-surface-2)]/40"
      >
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-3">
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-bold tracking-tight">
              {brand.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={brand.logoUrl}
                  alt={brand.name}
                  className="h-8 w-auto object-contain"
                />
              ) : (
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--color-brand)] text-white">
                  <Sparkles className="h-4 w-4" />
                </span>
              )}
              <span>{brand.name}</span>
            </div>
            <p className="text-xs leading-relaxed text-[var(--color-muted)]">
              {brand.about ?? brand.tagline}
            </p>
            {[brand.address, brand.city, brand.country]
              .filter(Boolean)
              .join(", ") && (
              <p className="text-xs text-[var(--color-muted)]">
                {[brand.address, brand.city, brand.country]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            )}
          </div>
          <div className="space-y-2 text-sm">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
              Get in touch
            </h4>
            {brand.email && (
              <a
                href={`mailto:${brand.email}`}
                className="flex items-center gap-2 text-[var(--color-foreground)]/80 hover:text-[var(--color-brand)]"
              >
                <Mail className="h-4 w-4" />
                {brand.email}
              </a>
            )}
            {brand.phone && (
              <a
                href={`tel:${brand.phone.replace(/[^+\d]/g, "")}`}
                className="flex items-center gap-2 text-[var(--color-foreground)]/80 hover:text-[var(--color-brand)]"
              >
                <Phone className="h-4 w-4" />
                {brand.phone}
              </a>
            )}
            {brand.whatsapp && (
              <a
                href={`https://wa.me/${brand.whatsapp.replace(/[^0-9]/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-[var(--color-foreground)]/80 hover:text-emerald-500"
              >
                <MessageCircle className="h-4 w-4" />
                {brand.whatsapp}
              </a>
            )}
            {brand.website && (
              <a
                href={
                  brand.website.startsWith("http")
                    ? brand.website
                    : `https://${brand.website}`
                }
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-[var(--color-foreground)]/80 hover:text-[var(--color-brand)]"
              >
                <Globe className="h-4 w-4" />
                {brand.website.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
          <div className="space-y-2 text-sm">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
              Follow us
            </h4>
            <div className="flex flex-wrap gap-3">
              {brand.instagram && (
                <a
                  href={brand.instagram}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Instagram"
                  className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--color-border)] text-[var(--color-foreground)]/80 transition-colors hover:border-rose-500 hover:text-rose-500"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
              {brand.facebook && (
                <a
                  href={brand.facebook}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Facebook"
                  className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--color-border)] text-[var(--color-foreground)]/80 transition-colors hover:border-sky-500 hover:text-sky-500"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
              {brand.linkedin && (
                <a
                  href={brand.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="LinkedIn"
                  className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--color-border)] text-[var(--color-foreground)]/80 transition-colors hover:border-indigo-500 hover:text-indigo-500"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="border-t border-[var(--color-border)] bg-[var(--color-surface-2)]/60">
          <div className="mx-auto max-w-6xl px-4 py-3 text-[11px] text-[var(--color-muted)]">
            © {new Date().getUTCFullYear()} {brand.legalName || brand.name}.{" "}
            All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
