"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Calendar } from "lucide-react";

// Top-of-dashboard month picker. Shows only the months that actually have
// data (passed in by the server), defaulting to the currently-selected
// month so the URL stays in sync with the dropdown.
export function MonthSelector({
  options,
  selected,
  basePath,
}: {
  options: { key: string; label: string }[];
  selected: string;
  basePath: string;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const [pending, start] = useTransition();
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
        <Calendar className="h-3.5 w-3.5" />
        Month
      </span>
      <span className="inline-flex h-10 items-center rounded-xl border-2 border-[var(--color-border)] bg-white px-3 transition-colors focus-within:border-[var(--color-brand)] focus-within:ring-[3px] focus-within:ring-[var(--color-brand)]/20 hover:border-[#cbd5d3]">
        <select
          value={selected}
          onChange={(e) => {
            const v = e.target.value;
            // Preserve unrelated params (active tab, search, etc.) but
            // reset pagination since the row set changes.
            const params = new URLSearchParams(search.toString());
            params.set("month", v);
            params.delete("page");
            start(() => router.push(`${basePath}?${params.toString()}`));
          }}
          disabled={pending || options.length === 0}
          className="h-full bg-transparent pr-2 text-sm font-medium focus:outline-none"
        >
          {options.length === 0 ? (
            <option value="">No data yet</option>
          ) : (
            options.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))
          )}
        </select>
      </span>
    </div>
  );
}
