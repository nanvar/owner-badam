"use client";

// Reusable empty state for the owner panel. Renders a centred
// illustration (or a default Lucide glyph if no image is provided),
// a friendly headline, optional supporting copy and an optional
// call-to-action. Keep the props shallow so individual pages can
// drop it in without ceremony.

import Link from "next/link";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  illustration,
  icon,
  action,
  className,
}: {
  title: string;
  description?: string;
  /** Public path to an SVG/PNG illustration (e.g. /illustrations/empty.svg). */
  illustration?: string;
  /** Lucide icon shown when no illustration is supplied. */
  icon?: React.ReactNode;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-brand-soft)]/60 via-white to-white px-6 py-12 text-center sm:py-16",
        className,
      )}
    >
      {/* Soft decorative glow behind the illustration. */}
      <div className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-[var(--color-brand)]/10 blur-3xl" />

      <div className="relative mx-auto flex max-w-md flex-col items-center gap-3">
        {illustration ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={illustration}
            alt=""
            className="h-32 w-auto object-contain drop-shadow-md sm:h-40"
          />
        ) : (
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
            {icon}
          </div>
        )}
        <h3 className="text-base font-semibold text-[var(--color-foreground)] sm:text-lg">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-[var(--color-muted)]">{description}</p>
        )}
        {action &&
          (action.href ? (
            <Link
              href={action.href}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-brand)]/90"
            >
              {action.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-brand)]/90"
            >
              {action.label}
            </button>
          ))}
      </div>
    </div>
  );
}
