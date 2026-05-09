"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

// Compact month picker. Surfaces only the months passed in by the
// server (so callers stay in charge of which periods are valid) and
// keeps unrelated query params intact when navigating.
export function MonthSelector({
  options,
  selected,
  basePath,
  allowAll,
}: {
  options: { key: string; label: string }[];
  selected: string;
  basePath: string;
  // When true, prepends an "All months" option that clears the
  // `month` param so callers can show data across every period.
  allowAll?: boolean;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const [pending, start] = useTransition();
  const empty = options.length === 0 && !allowAll;
  return (
    <span className="inline-flex h-10 items-center rounded-xl border-2 border-[var(--color-border)] bg-white px-3 transition-colors focus-within:border-[var(--color-brand)] focus-within:ring-[3px] focus-within:ring-[var(--color-brand)]/20 hover:border-[#cbd5d3]">
      <select
        value={selected}
        onChange={(e) => {
          const v = e.target.value;
          // Preserve unrelated params (active tab, search, etc.) but
          // reset pagination since the row set changes.
          const params = new URLSearchParams(search.toString());
          if (v) {
            params.set("month", v);
          } else {
            params.delete("month");
          }
          params.delete("page");
          const qs = params.toString();
          start(() => router.push(qs ? `${basePath}?${qs}` : basePath));
        }}
        disabled={pending || empty}
        className="h-full bg-transparent pr-2 text-sm font-medium focus:outline-none"
      >
        {empty ? (
          <option value="">No data yet</option>
        ) : (
          <>
            {allowAll && <option value="">All months</option>}
            {options.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </>
        )}
      </select>
    </span>
  );
}
