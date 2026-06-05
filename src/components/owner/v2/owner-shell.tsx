"use client";

// v2 OwnerShell — mobile-first layout. Replaces the generic AppShell
// for the owner panel. Two surfaces:
//   • Top bar — minimal: brand initial + activity bell + profile menu.
//     Title comes from the page itself (no PageHeader inside the
//     shell). Sticky, glass background on scroll.
//   • Bottom nav — fixed 4-item rail with iOS-style spring active
//     indicator. The 5th item (More) lives in a sheet for power-user
//     destinations (Notifications settings, Stay requests, Logout).
//
// All content scrolls under both surfaces.

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Home,
  Building2,
  Bell,
  MoreHorizontal,
  Settings,
  BedDouble,
  Wallet,
  Calendar,
  FileText,
  LogOut,
  X,
  Menu,
} from "lucide-react";
import { AvatarChip } from "./primitives";
import { ActivityBell } from "@/components/activity-bell";
import { logoutAction } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

export type ShellUser = {
  name: string | null;
  email: string;
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

export function OwnerShellV2({
  locale,
  user,
  children,
  brandLogoUrl,
  brandName,
}: {
  locale: string;
  user: ShellUser;
  children: React.ReactNode;
  brandLogoUrl?: string | null;
  brandName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [, startLogout] = useTransition();

  const primary: NavItem[] = [
    {
      href: `/${locale}/owner`,
      label: "Home",
      icon: <Home className="h-[22px] w-[22px]" />,
    },
    {
      href: `/${locale}/owner/properties`,
      label: "Properties",
      icon: <Building2 className="h-[22px] w-[22px]" />,
    },
    {
      href: `/${locale}/owner/calendar`,
      label: "Calendar",
      icon: <Calendar className="h-[22px] w-[22px]" />,
    },
    {
      href: `/${locale}/owner/reports`,
      label: "Reports",
      icon: <FileText className="h-[22px] w-[22px]" />,
    },
  ];

  const more: NavItem[] = [
    {
      href: `/${locale}/owner/payments`,
      label: "Payments",
      icon: <Wallet className="h-4 w-4" />,
    },
    {
      href: `/${locale}/owner/stay-requests`,
      label: "Stay requests",
      icon: <BedDouble className="h-4 w-4" />,
    },
    {
      href: `/${locale}/owner/activity`,
      label: "Activity feed",
      icon: <Bell className="h-4 w-4" />,
    },
    {
      href: `/${locale}/owner/notifications`,
      label: "Notification settings",
      icon: <Settings className="h-4 w-4" />,
    },
  ];

  const isActive = (href: string) => {
    if (href === `/${locale}/owner`) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  };

  const handleLogout = () => {
    startLogout(async () => {
      await logoutAction();
      router.push(`/${locale}/login`);
    });
  };

  return (
    <div className="relative flex min-h-dvh flex-col bg-[var(--color-surface)]">
      {/* ===== Top bar — minimal glass header ===== */}
      <header className="sticky top-0 z-40 border-b border-[var(--color-border)]/60 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            {/* Hamburger — drawer with the full nav list. Mobile-only;
                desktop has enough space for the bottom-nav alone. */}
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Menu"
              className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--color-border)] bg-white text-[var(--color-muted)] transition-colors hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] md:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            <Link
              href={`/${locale}/owner`}
              className="flex items-center gap-2 font-semibold tracking-tight"
              aria-label={brandName}
            >
              {brandLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={brandLogoUrl}
                  alt={brandName}
                  className="h-7 w-auto object-contain"
                />
              ) : (
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--color-brand)] text-sm font-bold text-white">
                  {(brandName || "B")[0]}
                </span>
              )}
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <ActivityBell
              locale={locale}
              viewAllHref={`/${locale}/owner/activity`}
            />
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="rounded-full transition-transform active:scale-95"
              aria-label="Profile"
            >
              <AvatarChip name={user.name ?? user.email} size={36} tone="warm" />
            </button>
          </div>
        </div>
      </header>

      {/* ===== Main content area — capped at 2xl, pb-28 for nav ===== */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-3 pb-28 pt-3 sm:px-4">
        {children}
      </main>

      {/* ===== Bottom nav — 4 primary + More ===== */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)]/60 bg-white/95 backdrop-blur-md"
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)",
          boxShadow:
            "0 -12px 32px -16px rgba(15,23,42,0.18), 0 -2px 8px -4px rgba(15,23,42,0.06)",
        }}
      >
        <div className="mx-auto flex max-w-md items-stretch">
          {primary.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group relative flex flex-1 flex-col items-center justify-center gap-1 px-1 pt-2.5 pb-2"
              >
                <span className="relative grid h-9 w-14 place-items-center">
                  {active && (
                    <motion.span
                      layoutId="v2-bottom-nav-pill"
                      className="absolute inset-0 rounded-full bg-[var(--color-brand-soft)]"
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 34,
                      }}
                    />
                  )}
                  <motion.span
                    initial={false}
                    animate={{ scale: active ? 1.08 : 1 }}
                    transition={{ type: "spring", stiffness: 420, damping: 28 }}
                    className={cn(
                      "relative grid place-items-center transition-colors",
                      active
                        ? "text-[var(--color-brand)]"
                        : "text-[var(--color-muted)]",
                    )}
                  >
                    {item.icon}
                  </motion.span>
                </span>
                <span
                  className={cn(
                    "text-[10px] font-medium tracking-tight transition-colors",
                    active
                      ? "text-[var(--color-brand)]"
                      : "text-[var(--color-muted)]",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="group relative flex flex-1 flex-col items-center justify-center gap-1 px-1 pt-2.5 pb-2"
            aria-label="More"
          >
            <span className="relative grid h-9 w-14 place-items-center">
              <span className="grid h-[22px] w-[22px] place-items-center text-[var(--color-muted)]">
                <MoreHorizontal className="h-[22px] w-[22px]" />
              </span>
            </span>
            <span className="text-[10px] font-medium tracking-tight text-[var(--color-muted)]">
              More
            </span>
          </button>
        </div>
      </nav>

      {/* ===== Full nav drawer — opened from the hamburger ===== */}
      <AnimatePresence>
        {menuOpen && (
          <SheetOverlay
            onClose={() => setMenuOpen(false)}
            title="Menu"
            side="left"
          >
            <ul className="space-y-1.5">
              {[...primary, ...more].map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm font-medium transition-colors",
                        active
                          ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand)]"
                          : "border-[var(--color-border)] bg-white hover:border-[var(--color-brand)]",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-9 w-9 place-items-center rounded-xl",
                          active
                            ? "bg-white text-[var(--color-brand)]"
                            : "bg-[var(--color-surface-2)] text-[var(--color-muted)]",
                        )}
                      >
                        {item.icon}
                      </span>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </SheetOverlay>
        )}
      </AnimatePresence>

      {/* ===== More sheet ===== */}
      <AnimatePresence>
        {moreOpen && (
          <SheetOverlay onClose={() => setMoreOpen(false)} title="More">
            <ul className="space-y-1.5">
              {more.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-white px-3 py-3 text-sm font-medium hover:border-[var(--color-brand)]"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--color-surface-2)] text-[var(--color-muted)]">
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </SheetOverlay>
        )}
      </AnimatePresence>

      {/* ===== Profile sheet ===== */}
      <AnimatePresence>
        {profileOpen && (
          <SheetOverlay onClose={() => setProfileOpen(false)} title="Account">
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-2xl bg-[var(--color-surface-2)]/60 p-3">
                <AvatarChip name={user.name ?? user.email} size={48} tone="warm" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    {user.name ?? user.email}
                  </div>
                  <div className="truncate text-xs text-[var(--color-muted)]">
                    {user.email}
                  </div>
                </div>
              </div>
              <Link
                href={`/${locale}/owner/notifications`}
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-white px-3 py-3 text-sm font-medium hover:border-[var(--color-brand)]"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--color-surface-2)] text-[var(--color-muted)]">
                  <Settings className="h-4 w-4" />
                </span>
                Settings
              </Link>
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  handleLogout();
                }}
                className="flex w-full items-center gap-3 rounded-2xl border border-rose-500/30 bg-white px-3 py-3 text-sm font-medium text-rose-600 hover:bg-rose-500/5"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-rose-500/10 text-rose-600">
                  <LogOut className="h-4 w-4" />
                </span>
                Log out
              </button>
            </div>
          </SheetOverlay>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Animated drawer/sheet. Side controls which edge it slides from:
 *  - "bottom" (default): bottom-sheet on mobile, centered modal on desktop
 *  - "left": full-height slide-in from the left edge (hamburger nav)
 *  - "right": full-height slide-in from the right edge (notifications)
 */
function SheetOverlay({
  title,
  children,
  onClose,
  side = "bottom",
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  side?: "bottom" | "left" | "right";
}) {
  const isLeft = side === "left";
  const isRight = side === "right";
  const isSide = isLeft || isRight;

  const initial = isLeft
    ? { x: "-100%", opacity: 1 }
    : isRight
      ? { x: "100%", opacity: 1 }
      : { y: 32, opacity: 0 };
  const animate = isSide ? { x: 0, opacity: 1 } : { y: 0, opacity: 1 };
  const exit = isLeft
    ? { x: "-100%", opacity: 1 }
    : isRight
      ? { x: "100%", opacity: 1 }
      : { y: 32, opacity: 0 };

  const containerClass = isSide
    ? `fixed inset-0 z-[60] flex ${isLeft ? "justify-start" : "justify-end"}`
    : "fixed inset-0 z-[60] flex items-end sm:items-center sm:justify-center";

  const panelClass = isSide
    ? `relative flex h-full w-[86vw] max-w-sm flex-col overflow-y-auto bg-white p-4 shadow-2xl ${
        isLeft ? "rounded-r-[28px]" : "rounded-l-[28px]"
      }`
    : "relative w-full max-w-md rounded-t-[28px] bg-white p-4 shadow-2xl sm:rounded-[28px]";

  return (
    <div className={containerClass}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={initial}
        animate={animate}
        exit={exit}
        transition={
          isSide
            ? { type: "spring", stiffness: 360, damping: 36 }
            : { duration: 0.24, ease: [0.16, 1, 0.3, 1] }
        }
        className={panelClass}
        style={
          isSide
            ? { paddingTop: "max(env(safe-area-inset-top), 1rem)" }
            : { paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }
        }
      >
        {!isSide && (
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--color-border)] sm:hidden" />
        )}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-lg text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}
