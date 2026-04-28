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
