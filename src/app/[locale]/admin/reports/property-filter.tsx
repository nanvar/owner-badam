"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Building2 } from "lucide-react";

type Option = {
  id: string;
  name: string;
  color: string;
  ownerName: string;
};

// Single-purpose filter: pick a property and the report list reloads
// scoped to that property. Empty value clears the filter.
export function ReportsPropertyFilter({
  properties,
  selectedPropertyId,
  basePath,
}: {
  properties: Option[];
  selectedPropertyId: string;
  basePath: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="mb-4 flex items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
        <Building2 className="h-3.5 w-3.5" />
        Property
      </span>
      <span className="inline-flex h-10 items-center rounded-xl border-2 border-[var(--color-border)] bg-white px-3 transition-colors focus-within:border-[var(--color-brand)] focus-within:ring-[3px] focus-within:ring-[var(--color-brand)]/20 hover:border-[#cbd5d3]">
        <select
          value={selectedPropertyId}
          onChange={(e) => {
            const v = e.target.value;
            const url = v ? `${basePath}?propertyId=${v}` : basePath;
            start(() => router.push(url));
          }}
          disabled={pending || properties.length === 0}
          className="h-full bg-transparent pr-2 text-sm font-medium focus:outline-none"
        >
          <option value="">All properties</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.ownerName}
            </option>
          ))}
        </select>
      </span>
    </div>
  );
}
