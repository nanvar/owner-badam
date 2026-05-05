"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

type PropertyOption = { id: string; name: string; color: string };

export function NewReportButton({
  properties,
  basePath,
}: {
  properties: PropertyOption[];
  basePath: string; // e.g. /en/admin/reports
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
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
    <div ref={ref} className="relative">
      <Button onClick={() => setOpen((v) => !v)}>
        <Plus className="h-4 w-4" />
        New report
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-64 origin-top-right overflow-hidden rounded-xl border border-[var(--color-border)] bg-white py-1 shadow-lg shadow-black/10 ring-1 ring-black/5 animate-fade-in">
          {properties.length === 0 ? (
            <div className="px-3 py-3 text-sm text-[var(--color-muted)]">
              No properties yet.
            </div>
          ) : (
            <>
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                Pick a property
              </div>
              {properties.map((p) => (
                <Link
                  key={p.id}
                  href={`${basePath}/new?propertyId=${p.id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-2)]"
                >
                  <span
                    className="h-5 w-1 shrink-0 rounded-full"
                    style={{ background: p.color }}
                  />
                  <span className="flex-1 truncate">{p.name}</span>
                </Link>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
