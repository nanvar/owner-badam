import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Deterministic currency formatter that produces the exact same string in
// Node and the browser, so SSR-hydrated values never trip React's mismatch
// warning the way Intl.NumberFormat does (different ICU versions emit
// different separator characters / spacing).
export function formatCurrency(
  value: number,
  currency = "AED",
  locale: string = "en",
) {
  const n = Math.round(value);
  const abs = Math.abs(n);
  const sep = locale === "ru" ? " " : ",";
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return `${currency} ${n < 0 ? "-" : ""}${formatted}`;
}

export function formatDate(date: Date | string, locale = "en") {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dubai",
  }).format(d);
}

export function formatShortDate(date: Date | string, locale = "en") {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Dubai",
  }).format(d);
}

export function dayInDubai(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    timeZone: "Asia/Dubai",
  }).format(d);
}

export function monthInDubai(date: Date | string, locale = "en") {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
    month: "short",
    timeZone: "Asia/Dubai",
  })
    .format(d)
    .toUpperCase();
}

export function nightsBetween(checkIn: Date, checkOut: Date) {
  const ms = checkOut.getTime() - checkIn.getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

export function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
export function endOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
export function addDays(d: Date, days: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

// "YYYY-MM" billing-month key for monthly reporting. Pass nextMonth=true
// to roll a transaction into the following month — kept for legacy
// callers; new code uses monthOptions/monthLabel directly.
export function monthKeyFor(date: Date | string, nextMonth = false): string {
  const d = typeof date === "string" ? new Date(date) : new Date(date);
  if (nextMonth) d.setUTCMonth(d.getUTCMonth() + 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// 12 month options centred on the current month: 6 past, current, 5
// future. Returned newest-first so the dropdown reads top-to-bottom from
// most recent past to furthest future. Useful for billing-month pickers.
export function monthOptions(
  now: Date = new Date(),
  past = 6,
  future = 5,
): { key: string; label: string }[] {
  const opts: { key: string; label: string }[] = [];
  for (let i = -past; i <= future; i++) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1),
    );
    opts.push({ key: monthKeyFor(d), label: monthLabel(d) });
  }
  return opts;
}

// Pulls Airbnb's booking reference (e.g. "HM4JEPEPNZ") out of the
// reservation description URL — Airbnb embeds it as
// `https://www.airbnb.com/hosting/reservations/details/<REF>`. Returns
// null when the description is missing or doesn't carry the URL.
export function extractBookingRef(
  description: string | null | undefined,
): string | null {
  if (!description) return null;
  const m = description.match(
    /airbnb\.com\/(?:hosting\/)?reservations(?:\/details)?\/([A-Z0-9]+)/i,
  );
  return m?.[1] ?? null;
}

// Friendly label like "May 2026" for a Date or "YYYY-MM" key.
export function monthLabel(input: Date | string, locale = "en"): string {
  const d =
    typeof input === "string"
      ? new Date(`${input}-01T00:00:00Z`)
      : new Date(input);
  return d.toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
