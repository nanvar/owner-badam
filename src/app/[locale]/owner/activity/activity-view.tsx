"use client";

// Owner activity timeline. Grouped by day for easy scanning, with a
// "Mark all read" action that hits the API directly. Initial page is
// SSR'd; "Load more" pulls subsequent pages via cursor pagination.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  CalendarPlus,
  CalendarCheck,
  Receipt,
  Wallet,
  FileText,
  HandCoins,
  CheckCircle2,
  Wrench,
  AlertCircle,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app-shell";
import { FadeIn, StaggerList } from "@/components/ui/motion";
import { EmptyState } from "@/components/owner/empty-state";
import { cn, formatDate } from "@/lib/utils";
import type { Locale } from "@/i18n/config";

type Item = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: unknown;
  readAt: string | null;
  createdAt: string;
};

const ICONS: Record<string, { icon: React.ReactNode; tone: string }> = {
  NEW_RESERVATION: { icon: <CalendarPlus className="h-4 w-4" />, tone: "sky" },
  RESERVATION_PAID: { icon: <CalendarCheck className="h-4 w-4" />, tone: "emerald" },
  CHECK_IN_TODAY: { icon: <CalendarCheck className="h-4 w-4" />, tone: "indigo" },
  CHECK_OUT_TODAY: { icon: <CalendarCheck className="h-4 w-4" />, tone: "indigo" },
  NEW_EXPENSE: { icon: <Receipt className="h-4 w-4" />, tone: "rose" },
  PROPERTY_EVENT: { icon: <Wrench className="h-4 w-4" />, tone: "amber" },
  PROPERTY_DOCUMENT_UPLOADED: { icon: <FileText className="h-4 w-4" />, tone: "amber" },
  NEW_REPORT: { icon: <FileText className="h-4 w-4" />, tone: "emerald" },
  OWNER_PAYMENT_RECORDED: { icon: <Wallet className="h-4 w-4" />, tone: "emerald" },
  SERVICE_CHARGE_DUE: { icon: <AlertCircle className="h-4 w-4" />, tone: "rose" },
  SERVICE_CHARGE_PAID: { icon: <CheckCircle2 className="h-4 w-4" />, tone: "emerald" },
  OWNER_DEBT_CREATED: { icon: <HandCoins className="h-4 w-4" />, tone: "rose" },
  OWNER_DEBT_SETTLED: { icon: <CheckCircle2 className="h-4 w-4" />, tone: "emerald" },
  STAY_REQUEST_APPROVED: { icon: <CalendarCheck className="h-4 w-4" />, tone: "emerald" },
  STAY_REQUEST_REJECTED: { icon: <AlertCircle className="h-4 w-4" />, tone: "rose" },
};

const TONE_BG: Record<string, string> = {
  sky: "bg-sky-500/15 text-sky-700",
  emerald: "bg-emerald-500/15 text-emerald-700",
  indigo: "bg-indigo-500/15 text-indigo-700",
  rose: "bg-rose-500/15 text-rose-700",
  amber: "bg-amber-500/15 text-amber-700",
};

function dayLabel(iso: string, locale: string) {
  const d = new Date(iso);
  const now = new Date();
  if (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  ) {
    return "Today";
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  ) {
    return "Yesterday";
  }
  return formatDate(iso, locale);
}

function timeLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ActivityView({
  locale,
  initialItems,
  initialNextCursor,
  initialUnread,
}: {
  locale: Locale;
  initialItems: Item[];
  initialNextCursor: string | null;
  initialUnread: number;
}) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialNextCursor);
  const [unread, setUnread] = useState(initialUnread);
  const [loadingMore, setLoadingMore] = useState(false);
  const markedRef = useRef(false);

  // On mount: mark everything as read since the user is now looking
  // at the feed. Cheap optimistic update + API call.
  useEffect(() => {
    if (markedRef.current) return;
    markedRef.current = true;
    if (unread === 0) return;
    fetch("/api/v1/owner/activity/read", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: "{}",
    })
      .then(() => {
        setUnread(0);
        setItems((arr) =>
          arr.map((it) => ({
            ...it,
            readAt: it.readAt ?? new Date().toISOString(),
          })),
        );
      })
      .catch(() => undefined);
  }, [unread]);

  // Group by day for the timeline render.
  const groups = useMemo(() => {
    const out: Array<{ label: string; items: Item[] }> = [];
    for (const it of items) {
      const label = dayLabel(it.createdAt, locale);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(it);
      else out.push({ label, items: [it] });
    }
    return out;
  }, [items, locale]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const r = await fetch(
        `/api/v1/owner/activity?cursor=${encodeURIComponent(cursor)}&limit=25`,
        {
          credentials: "include",
          headers: { Accept: "application/json" },
        },
      );
      if (r.ok) {
        const j = (await r.json()) as { items: Item[]; nextCursor: string | null };
        setItems((arr) => [...arr, ...j.items]);
        setCursor(j.nextCursor);
      }
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-[var(--color-brand)]" />
            Activity
          </span>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          title="All caught up"
          description="New bookings, reports and updates will land here as they happen."
          illustration="/illustrations/owner-activity-empty.svg"
          icon={<Bell className="h-7 w-7" />}
        />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.label}>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                {g.label}
              </div>
              <div className="space-y-2">
                {g.items.map((it) => {
                  const meta = ICONS[it.type] ?? {
                    icon: <Bell className="h-4 w-4" />,
                    tone: "sky",
                  };
                  return (
                    <div
                      key={it.id}
                      className={cn(
                        "flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-white p-3",
                        !it.readAt &&
                          "border-[var(--color-brand)]/40 bg-[var(--color-brand-soft)]/30",
                      )}
                    >
                      <div
                        className={cn(
                          "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                          TONE_BG[meta.tone],
                        )}
                      >
                        {meta.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm font-semibold leading-snug">
                            {it.title}
                          </div>
                          <div className="shrink-0 text-[10px] text-[var(--color-muted)]">
                            {timeLabel(it.createdAt)}
                          </div>
                        </div>
                        {it.body && (
                          <div className="mt-0.5 text-xs text-[var(--color-muted)]">
                            {it.body}
                          </div>
                        )}
                      </div>
                      {!it.readAt && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--color-brand)]" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {cursor && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-medium hover:bg-[var(--color-surface-2)] disabled:opacity-60"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </>
                ) : (
                  <>
                    Load older
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
