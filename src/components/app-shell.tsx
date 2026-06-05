"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  LogOut,
  Globe,
  Sparkles,
  Mail,
  Phone,
  MessageCircle,
  Info,
  KeyRound,
  Menu,
  ChevronDown,
  Check,
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
  // When set, the item renders as a dropdown menu on desktop and as a
  // grouped section in the mobile drawer. Bottom nav ignores children.
  children?: NavItem[];
};

export function AppShell({
  locale,
  user,
  nav,
  children,
  variant,
  topRight,
  brand,
  mobileNav = "bottom",
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
  // "bottom" — fixed bottom tab bar (works for ≤4 items); "drawer" — left
  // hamburger that slides in a Sheet (better when there are many items).
  mobileNav?: "bottom" | "drawer";
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
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Active nav item: prefix-match on the href (so /admin/company/expenses
  // highlights "Company expenses"). When a more-specific sibling also
  // matches (e.g. /admin/company is the parent of /admin/company/expenses),
  // the parent yields to the child so only one item lights up.
  const rootHref = `/${locale}/${variant}`;
  // Flatten nav (parents + children) so the active-detection prefix scan
  // can pick the most specific match across the whole menu.
  const flatNav: NavItem[] = nav.flatMap((n) => [n, ...(n.children ?? [])]);
  const isActive = (href: string) => {
    if (href === rootHref) return pathname === href;
    const selfMatch = pathname === href || pathname.startsWith(href + "/");
    if (!selfMatch) return false;
    const moreSpecific = flatNav.some(
      (other) =>
        other.href !== href &&
        other.href.startsWith(href + "/") &&
        (pathname === other.href || pathname.startsWith(other.href + "/")),
    );
    return !moreSpecific;
  };
  const isGroupActive = (item: NavItem) =>
    isActive(item.href) ||
    (item.children?.some((c) => isActive(c.href)) ?? false);

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
          {/* Hamburger lives in the top header on mobile for BOTH
              modes — bottom-nav surfaces only the first 5 items, so
              the drawer remains the only path to the rest. */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="mr-1 flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-border)] text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-foreground)] md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <Link
            href={`/${locale}/${variant}`}
            className={cn(
              "flex items-center gap-2 font-semibold tracking-tight",
              mobileNav === "drawer" && "col-start-2 md:col-start-1",
            )}
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
          {/* Inline nav inside the top header — owner variant only.
              Admin variant has too many items to fit, so it gets its
              own horizontal nav row below the header (see below). */}
          {variant === "admin" ? (
            <span />
          ) : (
            <nav className="hidden items-center justify-center gap-1 md:flex">
              {nav.map((item) =>
                item.children?.length ? (
                  <NavDropdown
                    key={item.href}
                    item={item}
                    isActive={isActive}
                    isGroupActive={isGroupActive}
                  />
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                      isActive(item.href)
                        ? "bg-[var(--color-brand-soft)] text-[var(--color-brand)]"
                        : "text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-foreground)]",
                    )}
                  >
                    {item.label}
                  </Link>
                ),
              )}
            </nav>
          )}
          <div className="flex items-center gap-2 justify-self-end">
            {topRight}
            <UserMenu
              user={user}
              locale={locale}
              onChangePassword={() => setPasswordOpen(true)}
              onSwitchLocale={switchLocale}
              onLogout={() => start(() => logoutAction())}
              logoutPending={pending}
            />
          </div>
        </div>
      </header>

      {/* Secondary nav row for the admin variant — full-width strip
          beneath the top bar with the menu items spread horizontally.
          Scrolls horizontally on narrow viewports so every section
          stays one tap away. Hidden on mobile where the bottom nav
          drawer covers it. */}
      {variant === "admin" && (
        <div className="sticky top-0 z-30 hidden border-b border-[var(--color-border)] bg-white md:block">
          <nav className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {nav.map((item) =>
              item.children?.length ? (
                <NavDropdown
                  key={item.href}
                  item={item}
                  isActive={isActive}
                  isGroupActive={isGroupActive}
                />
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "shrink-0 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive(item.href)
                      ? "bg-[var(--color-brand-soft)] text-[var(--color-brand)]"
                      : "text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-foreground)]",
                  )}
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>
        </div>
      )}

      <main
        className={cn(
          "mx-auto w-full max-w-6xl flex-1 px-4 pt-4 md:pb-10",
          mobileNav === "bottom" ? "pb-24" : "pb-10",
        )}
      >
        {children}
      </main>

      {brand && hasContacts && <BrandFooter brand={brand} />}

      {mobileNav === "bottom" && (
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)] bg-white md:hidden"
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)",
          boxShadow:
            "0 -16px 40px -12px rgba(15,23,42,0.22), 0 -6px 16px -8px rgba(15,23,42,0.12), 0 -1px 0 rgba(15,23,42,0.04)",
        }}
      >
        <div className="mx-auto flex max-w-md items-stretch">
          {/* Bottom nav shows the first 5 leaf nav items. Anything
              past that — plus dropdown parents — only appears in the
              drawer, opened from the top-bar hamburger. */}
          {nav
            .filter((item) => !item.children?.length)
            .slice(0, 5)
            .map((item) => {
            const active = isActive(item.href);
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
      )}

      {/* Drawer is always available on mobile — both nav modes feed it
          from the hamburger in the top bar. In bottom-nav mode it
          carries everything that didn't fit in the bottom rail; in
          drawer-only mode it's the primary nav. */}
      <Sheet
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        side="right"
        title="Menu"
      >
          <ul className="-mx-1 space-y-1">
            {nav.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-colors",
                      active
                        ? "bg-[var(--color-brand-soft)] text-[var(--color-brand)]"
                        : "text-[var(--color-foreground)] hover:bg-[var(--color-surface-2)]",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-9 w-9 place-items-center rounded-xl",
                        active
                          ? "bg-white/60 text-[var(--color-brand)]"
                          : "bg-[var(--color-surface-2)] text-[var(--color-muted)]",
                      )}
                    >
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                  {item.children?.length ? (
                    <ul className="ml-12 mt-1 space-y-1">
                      {item.children.map((child) => {
                        const childActive = isActive(child.href);
                        return (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              onClick={() => setDrawerOpen(false)}
                              className={cn(
                                "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                                childActive
                                  ? "bg-[var(--color-brand-soft)] text-[var(--color-brand)]"
                                  : "text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-foreground)]",
                              )}
                            >
                              {child.icon}
                              {child.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
              );
            })}
            {brand && hasContacts && (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    setContactOpen(true);
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-2)]"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--color-surface-2)] text-[var(--color-muted)]">
                    <Info className="h-4 w-4" />
                  </span>
                  Contact
                </button>
              </li>
            )}
          </ul>
        </Sheet>

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

function NavDropdown({
  item,
  isActive,
  isGroupActive,
}: {
  item: NavItem;
  isActive: (href: string) => boolean;
  isGroupActive: (item: NavItem) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  });
  const active = isGroupActive(item);

  // Position the portal'd menu directly under the trigger. Recalculate
  // on open + on scroll/resize so it stays anchored as the sticky bar
  // moves with the page. The menu lives outside the overflow-x-auto
  // nav container so it never gets clipped by the scroll viewport.
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const update = () => {
      const r = buttonRef.current!.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left + r.width / 2, width: r.width });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex shrink-0 items-center gap-1 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors",
          active
            ? "bg-[var(--color-brand-soft)] text-[var(--color-brand)]"
            : "text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-foreground)]",
        )}
      >
        {item.label}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      <AnimatePresence>
        {open && typeof document !== "undefined" &&
          createPortal(
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: "fixed",
                top: pos.top,
                left: pos.left,
                transform: "translateX(-50%)",
                zIndex: 80,
              }}
              className="w-56 origin-top overflow-hidden rounded-xl border border-[var(--color-border)] bg-white py-1 shadow-xl shadow-black/10 ring-1 ring-black/5"
            >
              {item.children!.map((child) => {
                const childActive = isActive(child.href);
                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors",
                      childActive
                        ? "bg-[var(--color-brand-soft)] text-[var(--color-brand)]"
                        : "text-[var(--color-foreground)] hover:bg-[var(--color-surface-2)]",
                    )}
                  >
                    <span className="text-[var(--color-muted)]">
                      {child.icon}
                    </span>
                    {child.label}
                  </Link>
                );
              })}
            </motion.div>,
            document.body,
          )}
      </AnimatePresence>
    </>
  );
}

/**
 * Avatar-led user menu — consolidates the formerly-stacked key/globe/
 * logout icon row into a single dropdown that opens via portal so it
 * always sits above page content. Shows name + role + email at the top
 * then the actions list (locale switch, change password, logout).
 */
function UserMenu({
  user,
  locale,
  onChangePassword,
  onSwitchLocale,
  onLogout,
  logoutPending,
}: {
  user: { name: string | null; email: string; role: "ADMIN" | "OWNER" | "SUPERADMIN" };
  locale: Locale;
  onChangePassword: () => void;
  onSwitchLocale: (l: Locale) => void;
  onLogout: () => void;
  logoutPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; right: number }>({
    top: 0,
    right: 0,
  });

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const update = () => {
      const r = buttonRef.current!.getBoundingClientRect();
      setPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Initials from name (first chars of up to two words) or email.
  const displayName = user.name ?? user.email;
  const initials = (user.name
    ? user.name
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0])
        .join("")
    : user.email[0]
  ).toUpperCase();

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white py-1 pl-1 pr-2.5 text-left transition-colors hover:border-[var(--color-brand)] hover:bg-[var(--color-brand-soft)]/40"
        aria-label="Account menu"
      >
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--color-brand)] text-[11px] font-bold text-white">
          {initials}
        </span>
        <span className="hidden flex-col leading-tight sm:flex">
          <span className="text-[11px] font-semibold tracking-tight">
            {displayName}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
            {user.role}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "ml-0.5 h-3.5 w-3.5 text-[var(--color-muted)] transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence>
        {open && typeof document !== "undefined" &&
          createPortal(
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 80 }}
              className="w-64 origin-top-right overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-xl shadow-black/10 ring-1 ring-black/5"
            >
              <div className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/40 px-3 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--color-brand)] text-sm font-bold text-white">
                    {initials}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {displayName}
                    </div>
                    <div className="truncate text-[11px] text-[var(--color-muted)]">
                      {user.email}
                    </div>
                  </div>
                </div>
                <div className="mt-2 inline-flex items-center rounded-full bg-[var(--color-brand-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand)]">
                  {user.role}
                </div>
              </div>

              <div className="px-1 py-1">
                <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Language
                </div>
                {(["en", "ru"] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onSwitchLocale(l);
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm hover:bg-[var(--color-surface-2)]"
                  >
                    <span className="flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5 text-[var(--color-muted)]" />
                      {l === "en" ? "English" : "Русский"}
                    </span>
                    {locale === l && (
                      <Check className="h-3.5 w-3.5 text-[var(--color-brand)]" />
                    )}
                  </button>
                ))}
              </div>

              <div className="border-t border-[var(--color-border)] px-1 py-1">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onChangePassword();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm hover:bg-[var(--color-surface-2)]"
                >
                  <KeyRound className="h-3.5 w-3.5 text-[var(--color-muted)]" />
                  Change password
                </button>
                <button
                  type="button"
                  disabled={logoutPending}
                  onClick={() => {
                    setOpen(false);
                    onLogout();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-rose-600 hover:bg-rose-500/10 disabled:opacity-60"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Log out
                </button>
              </div>
            </motion.div>,
            document.body,
          )}
      </AnimatePresence>
    </>
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
