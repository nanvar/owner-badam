"use client";

// Owner-panel v2 design primitives. Mobile-first — every component is
// designed to look right on a 375px screen first and grow gracefully
// on larger viewports. Same primitives feed the future RN app so the
// look stays consistent across web + native.

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================
// HeroGradient — warm gradient banner used at the top of feature
// pages. Soft glow blobs + glass-style header content.
// ============================================================
export function HeroGradient({
  children,
  className,
  tone = "brand",
}: {
  children: React.ReactNode;
  className?: string;
  /** "brand" = teal greens; "warm" = rose→gold (matches reference). */
  tone?: "brand" | "warm";
}) {
  const bg =
    tone === "warm"
      ? "linear-gradient(135deg, #f7c2a6 0%, #f08363 45%, #b73f66 100%)"
      : "linear-gradient(135deg, #4f8a6f 0%, #3d6f57 55%, #2f5a47 100%)";
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[28px] px-5 py-6 text-white sm:px-7 sm:py-8",
        className,
      )}
      style={{
        background: bg,
        boxShadow:
          "0 24px 48px -22px rgba(183,63,102,0.35), 0 12px 28px -18px rgba(15,23,42,0.18)",
      }}
    >
      <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-white/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-12 h-48 w-48 rounded-full bg-white/15 blur-3xl" />
      <div className="relative">{children}</div>
    </div>
  );
}

// ============================================================
// SoftCard — rounded-3xl, subtle border + shadow, white surface.
// The "default" card style across the v2 panel.
// ============================================================
export function SoftCard({
  children,
  className,
  as: As = "div",
  href,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "li";
  href?: string;
  onClick?: () => void;
}) {
  const classes = cn(
    "rounded-[24px] border border-[var(--color-border)] bg-white p-4 transition-shadow",
    (href || onClick) && "cursor-pointer hover:shadow-md active:scale-[.99]",
    className,
  );
  if (href) {
    return (
      <Link href={href} className={classes} onClick={onClick}>
        {children}
      </Link>
    );
  }
  return (
    <As className={classes} onClick={onClick}>
      {children}
    </As>
  );
}

// ============================================================
// SectionTitle — small uppercase label + optional right-aligned link
// styled like the reference's "Services / Events" headings.
// ============================================================
export function SectionTitle({
  children,
  link,
}: {
  children: React.ReactNode;
  link?: { label: string; href: string };
}) {
  return (
    <div className="mb-2 flex items-center justify-between px-1">
      <h2 className="text-base font-bold tracking-tight text-[var(--color-foreground)]">
        {children}
      </h2>
      {link && (
        <Link
          href={link.href}
          className="inline-flex items-center gap-0.5 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-brand)]"
        >
          {link.label}
          <ChevronRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

// ============================================================
// PillChip — capsule-style button used in service grids. Icon left
// + label right, pill border, scrollable rows.
// ============================================================
export function PillChip({
  icon,
  label,
  href,
  onClick,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
  tone?: "default" | "brand";
}) {
  const cls = cn(
    "group inline-flex shrink-0 items-center gap-2 rounded-full border bg-white px-3 py-2 text-sm font-medium shadow-sm transition-all active:scale-95",
    tone === "brand"
      ? "border-[var(--color-brand)] text-[var(--color-brand)]"
      : "border-[var(--color-border)] text-[var(--color-foreground)]",
  );
  const body = (
    <>
      <span
        className={cn(
          "grid h-7 w-7 place-items-center rounded-full",
          tone === "brand"
            ? "bg-[var(--color-brand-soft)] text-[var(--color-brand)]"
            : "bg-[var(--color-surface-2)] text-[var(--color-muted)] group-hover:bg-[var(--color-brand-soft)] group-hover:text-[var(--color-brand)]",
        )}
      >
        {icon}
      </span>
      {label}
    </>
  );
  if (href)
    return (
      <Link href={href} className={cls}>
        {body}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  );
}

// ============================================================
// Badge — small pill used over images / inline (e.g. "General &
// Primary Care", "Management only").
// ============================================================
export function CategoryBadge({
  children,
  tone = "warm",
}: {
  children: React.ReactNode;
  tone?: "warm" | "rose" | "indigo" | "emerald" | "amber" | "sky" | "slate";
}) {
  const tones: Record<typeof tone, string> = {
    warm: "bg-orange-100 text-orange-700",
    rose: "bg-rose-100 text-rose-700",
    indigo: "bg-indigo-100 text-indigo-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    sky: "bg-sky-100 text-sky-700",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

// ============================================================
// HorizontalScroll — horizontal-scroll lane used for service chips,
// e-cards carousel, etc. Hides native scrollbar.
// ============================================================
export function HorizontalScroll({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}

// ============================================================
// AvatarChip — round avatar with optional gradient background and
// initial fallback. Used in cards (e-Cards, doctor cards).
// ============================================================
export function AvatarChip({
  name,
  src,
  size = 36,
  tone = "warm",
}: {
  name?: string | null;
  src?: string | null;
  size?: number;
  tone?: "warm" | "brand";
}) {
  const initial = (name ?? "?").trim().charAt(0).toUpperCase() || "?";
  const bg =
    tone === "warm"
      ? "linear-gradient(135deg, #f7c2a6 0%, #f08363 60%, #b73f66 100%)"
      : "linear-gradient(135deg, #4f8a6f 0%, #2f5a47 100%)";
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name ?? ""}
        style={{ width: size, height: size }}
        className="rounded-full object-cover"
      />
    );
  }
  return (
    <span
      className="grid place-items-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.4 }}
    >
      {initial}
    </span>
  );
}
