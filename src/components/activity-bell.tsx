"use client";

// Bell icon in the owner topbar — shows unread activity count as a
// red dot badge, opens a dropdown preview, and links to the full
// /owner/activity timeline.
//
// Polls the unread-count endpoint every 30s while the tab is visible
// so push-less updates (no notification permission) still propagate.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: unknown;
  readAt: string | null;
  createdAt: string;
};

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const delta = Date.now() - t;
  if (delta < 60_000) return "just now";
  if (delta < 3_600_000) return Math.floor(delta / 60_000) + "m ago";
  if (delta < 86_400_000) return Math.floor(delta / 3_600_000) + "h ago";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

export function ActivityBell({
  locale,
  viewAllHref,
}: {
  locale: string;
  /** Where "View all activity" navigates. Defaults to /owner/activity. */
  viewAllHref?: string;
}) {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  // Poll unread count on mount + every 30s (tab visible only).
  useEffect(() => {
    let cancelled = false;
    const fetchCount = async () => {
      try {
        const r = await fetch("/api/v1/owner/activity/unread-count", {
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        if (!r.ok) return;
        const j = (await r.json()) as { count: number };
        if (!cancelled) setUnread(j.count ?? 0);
      } catch {
        /* swallow */
      }
    };
    fetchCount();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") fetchCount();
    }, 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchCount();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Click-outside to close. Mobile sheet has its own backdrop click so
  // we exempt clicks inside the sheet panel from the outside-close logic.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const inPop = popRef.current?.contains(target);
      const inSheet = sheetRef.current?.contains(target);
      if (!inPop && !inSheet) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const openPanel = async () => {
    setOpen((v) => !v);
    if (!open && items.length === 0) {
      setLoading(true);
      try {
        const r = await fetch("/api/v1/owner/activity?limit=6", {
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        if (r.ok) {
          const j = (await r.json()) as { items: Item[] };
          setItems(j.items);
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const markAllRead = async () => {
    try {
      const r = await fetch("/api/v1/owner/activity/read", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: "{}",
      });
      if (r.ok) {
        setUnread(0);
        setItems((arr) =>
          arr.map((it) => ({ ...it, readAt: it.readAt ?? new Date().toISOString() })),
        );
      }
    } catch {
      /* swallow */
    }
  };

  const closePanel = () => setOpen(false);

  const viewAll = viewAllHref ?? `/${locale}/owner/activity`;

  // "Mark all read" action — shared between desktop dropdown header and
  // mobile sheet header.
  const markAllReadButton = (
    <button
      type="button"
      onClick={markAllRead}
      disabled={unread === 0}
      className={cn(
        "text-xs font-medium",
        unread === 0
          ? "cursor-not-allowed text-[var(--color-muted)]"
          : "text-[var(--color-brand)] hover:underline",
      )}
    >
      Mark all read
    </button>
  );

  // Item list — tapping a row jumps to the full activity feed and closes
  // the panel. Previously rows were inert <li> elements, so on mobile it
  // looked broken when nothing happened on tap.
  const itemList = (
    <>
      {loading ? (
        <div className="px-3 py-8 text-center text-xs text-[var(--color-muted)]">
          Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="px-3 py-8 text-center text-xs text-[var(--color-muted)]">
          No activity yet.
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {items.map((it) => (
            <li key={it.id}>
              <Link
                href={viewAll}
                onClick={closePanel}
                className={cn(
                  "flex flex-col gap-0.5 px-3 py-3 transition-colors active:bg-[var(--color-surface-2)] sm:hover:bg-[var(--color-surface-2)]/60",
                  !it.readAt && "bg-[var(--color-brand-soft)]/40",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    {!it.readAt && (
                      <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--color-brand)]" />
                    )}
                    <div className="min-w-0 text-sm font-medium leading-snug">
                      {it.title}
                    </div>
                  </div>
                  <div className="shrink-0 text-[10px] text-[var(--color-muted)]">
                    {relTime(it.createdAt)}
                  </div>
                </div>
                {it.body && (
                  <div className="line-clamp-2 pl-4 text-xs text-[var(--color-muted)]">
                    {it.body}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );

  const viewAllFooter = (
    <div className="border-t border-[var(--color-border)] px-3 py-2.5">
      <Link
        href={viewAll}
        onClick={closePanel}
        className="block text-center text-sm font-semibold text-[var(--color-brand)] hover:underline"
      >
        View all activity
      </Link>
    </div>
  );

  return (
    <>
      <div className="relative" ref={popRef}>
        <button
          type="button"
          onClick={openPanel}
          className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-border)] text-[var(--color-muted)] transition-colors hover:border-[var(--color-brand)] hover:bg-[var(--color-brand-soft)] hover:text-[var(--color-brand)]"
          aria-label="Activity"
          title="Activity"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>

        {/* Desktop dropdown — anchored to the bell button */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="absolute right-0 top-11 z-[60] hidden w-80 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-xl sm:block"
            >
              <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
                <div className="text-sm font-semibold">Activity</div>
                {markAllReadButton}
              </div>
              <div className="max-h-[60vh] overflow-y-auto">{itemList}</div>
              {viewAllFooter}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile bottom-sheet — slides up from the bottom edge with a
          single, unified header (drag handle + title + actions + close).
          Sheet height is bounded to 85vh so it never reaches the top of
          the screen; the item list scrolls inside. */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[70] flex items-end sm:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
              onClick={closePanel}
            />
            <motion.div
              ref={sheetRef}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 360, damping: 36 }}
              className="relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl"
              style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}
            >
              <div className="shrink-0">
                <div className="mx-auto mb-2 mt-2 h-1 w-10 rounded-full bg-[var(--color-border)]" />
                <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] px-3 pb-2.5">
                  <div className="text-base font-bold">Activity</div>
                  <div className="flex items-center gap-2">
                    {markAllReadButton}
                    <button
                      type="button"
                      onClick={closePanel}
                      aria-label="Close"
                      className="grid h-8 w-8 place-items-center rounded-lg text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">{itemList}</div>
              <div className="shrink-0">{viewAllFooter}</div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
