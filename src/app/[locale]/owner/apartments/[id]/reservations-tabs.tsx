"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { User } from "lucide-react";
import {
  cn,
  formatCurrency,
  formatDate,
  dayInDubai,
  monthInDubai,
} from "@/lib/utils";
import type { Locale } from "@/i18n/config";

type Reservation = {
  id: string;
  guestName: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  pricePerNight: number;
  totalPrice: number;
  currency: string;
};

export function ReservationsTabs({
  upcoming,
  past,
  locale,
  labels,
}: {
  upcoming: Reservation[];
  past: Reservation[];
  locale: Locale;
  labels: {
    upcoming: string;
    past: string;
    noUpcoming: string;
    noPast: string;
    guest: string;
    total: string;
  };
}) {
  const [tab, setTab] = useState<"upcoming" | "past">(
    upcoming.length > 0 ? "upcoming" : "past",
  );
  const list = tab === "upcoming" ? upcoming : past;
  const emptyText = tab === "upcoming" ? labels.noUpcoming : labels.noPast;

  return (
    <section>
      <div className="relative mb-3 flex rounded-2xl border border-[var(--color-border)] bg-white p-1">
        <Tab
          active={tab === "upcoming"}
          onClick={() => setTab("upcoming")}
          label={labels.upcoming}
          count={upcoming.length}
        />
        <Tab
          active={tab === "past"}
          onClick={() => setTab("past")}
          label={labels.past}
          count={past.length}
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          {list.length === 0 ? (
            <div className="grid place-items-center rounded-2xl border border-dashed border-[var(--color-border)] bg-white px-6 py-10 text-sm text-[var(--color-muted)]">
              {emptyText}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((r) => (
                <Card
                  key={r.id}
                  reservation={r}
                  locale={locale}
                  accent={tab}
                  guestLabel={labels.guest}
                  totalLabel={labels.total}
                />
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

function Tab({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative isolate flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
        active
          ? "text-white"
          : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]",
      )}
    >
      {active && (
        <motion.span
          layoutId="apt-res-tab-pill"
          className="absolute inset-0 -z-10 rounded-xl"
          style={{
            background: "linear-gradient(135deg, #4f8a6f 0%, #3d6f57 100%)",
            boxShadow: "0 6px 16px -8px rgba(47,90,71,0.5)",
          }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
        />
      )}
      <span className="relative">{label}</span>
      <span
        className={cn(
          "relative rounded-full px-1.5 text-[10px] font-bold tabular-nums transition-colors",
          active
            ? "bg-white/25 text-white"
            : "bg-[var(--color-surface-2)] text-[var(--color-muted)]",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function Card({
  reservation,
  locale,
  accent,
  guestLabel,
  totalLabel,
}: {
  reservation: Reservation;
  locale: Locale;
  accent: "upcoming" | "past";
  guestLabel: string;
  totalLabel: string;
}) {
  const day = dayInDubai(reservation.checkIn);
  const month = monthInDubai(reservation.checkIn, locale);
  const cur = reservation.currency || "AED";

  return (
    <div
      className={cn(
        "rounded-2xl bg-white p-4 transition-shadow hover:shadow-md",
        accent === "upcoming"
          ? "border border-[var(--color-brand-soft)] shadow-sm"
          : "border border-[var(--color-border)]",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "grid h-12 w-12 shrink-0 place-items-center rounded-xl text-center leading-tight",
            accent === "upcoming"
              ? "bg-[var(--color-brand-soft)] text-[var(--color-brand)]"
              : "bg-[var(--color-surface-2)] text-[var(--color-muted)]",
          )}
        >
          <div>
            <div className="text-base font-bold leading-none">{day}</div>
            <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider">
              {month}
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <User className="h-3.5 w-3.5 shrink-0 text-[var(--color-muted)]" />
            <span className="truncate">{reservation.guestName ?? guestLabel}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-[var(--color-muted)]">
            <span>{formatDate(reservation.checkIn, locale)}</span>
            <span>→</span>
            <span>{formatDate(reservation.checkOut, locale)}</span>
            <span>·</span>
            <span>
              {reservation.nights}n
              {reservation.pricePerNight > 0 && (
                <>
                  {" · "}
                  {formatCurrency(reservation.pricePerNight, cur, locale)}/n
                </>
              )}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border)] pt-3 text-sm">
        <span className="text-[var(--color-muted)]">{totalLabel}</span>
        <span className="font-bold">
          {formatCurrency(reservation.totalPrice, cur, locale)}
        </span>
      </div>
    </div>
  );
}
