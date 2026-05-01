"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Search, Users } from "lucide-react";
import type { Locale } from "@/i18n/config";

export function SearchBar({ locale }: { locale: Locale }) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [guests, setGuests] = useState(2);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (guests) params.set("guests", String(guests));
    const qs = params.toString();
    router.push(`/${locale}${qs ? `?${qs}` : ""}#properties`);
  };

  return (
    <form
      onSubmit={submit}
      className="mx-auto flex w-full max-w-3xl flex-col gap-2 rounded-2xl border border-[var(--color-border)] bg-white p-2 shadow-xl shadow-emerald-900/10 sm:flex-row sm:rounded-full sm:p-1.5"
    >
      <label className="flex flex-1 items-center gap-2 rounded-xl px-4 py-2 transition-colors hover:bg-[var(--color-surface-2)]/50 sm:rounded-full">
        <Calendar className="h-4 w-4 shrink-0 text-[var(--color-muted)]" />
        <div className="flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
            Check-in
          </div>
          <input
            type="date"
            value={from}
            min={today}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full bg-transparent text-sm font-semibold focus:outline-none"
            aria-label="Check-in date"
          />
        </div>
      </label>
      <span className="hidden h-10 w-px self-center bg-[var(--color-border)] sm:block" />
      <label className="flex flex-1 items-center gap-2 rounded-xl px-4 py-2 transition-colors hover:bg-[var(--color-surface-2)]/50 sm:rounded-full">
        <Calendar className="h-4 w-4 shrink-0 text-[var(--color-muted)]" />
        <div className="flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
            Check-out
          </div>
          <input
            type="date"
            value={to}
            min={from || today}
            onChange={(e) => setTo(e.target.value)}
            className="w-full bg-transparent text-sm font-semibold focus:outline-none"
            aria-label="Check-out date"
          />
        </div>
      </label>
      <span className="hidden h-10 w-px self-center bg-[var(--color-border)] sm:block" />
      <label className="flex items-center gap-2 rounded-xl px-4 py-2 transition-colors hover:bg-[var(--color-surface-2)]/50 sm:rounded-full">
        <Users className="h-4 w-4 shrink-0 text-[var(--color-muted)]" />
        <div className="flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
            Guests
          </div>
          <input
            type="number"
            value={guests}
            min={1}
            max={20}
            onChange={(e) => setGuests(Number(e.target.value) || 1)}
            className="w-full bg-transparent text-sm font-semibold focus:outline-none"
            aria-label="Number of guests"
          />
        </div>
      </label>
      <button
        type="submit"
        className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--color-brand)] px-6 text-sm font-bold text-white shadow shadow-emerald-700/30 transition-transform hover:scale-[1.02] sm:rounded-full"
      >
        <Search className="h-4 w-4" />
        Search
      </button>
    </form>
  );
}
