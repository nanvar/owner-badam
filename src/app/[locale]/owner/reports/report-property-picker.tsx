"use client";

import { useState } from "react";
import {
  Building2,
  ChevronRight,
  MapPin,
  CalendarCheck,
  Globe,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { StaggerList, StaggerItem, HoverLift } from "@/components/ui/motion";
import { PropertyReport, type Labels } from "./property-report";
import type { Locale } from "@/i18n/config";

type Property = {
  id: string;
  name: string;
  address: string | null;
  color: string;
  createdAt: string;
  reservationCount: number;
};

type Selection =
  | { kind: "all" }
  | { kind: "one"; property: Property };

export function ReportPropertyPicker({
  locale,
  ownerName,
  properties,
  earliestCreatedAt,
  labels,
}: {
  locale: Locale;
  ownerName: string;
  properties: Property[];
  earliestCreatedAt: string | null;
  labels: Labels;
}) {
  const [selected, setSelected] = useState<Selection | null>(null);
  const totalReservations = properties.reduce(
    (s, p) => s + p.reservationCount,
    0,
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold tracking-tight md:text-2xl">
        {labels.title}
      </h1>

      <StaggerList className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* "All properties" entry first */}
        {properties.length > 0 && (
          <StaggerItem className="h-full">
            <HoverLift className="h-full">
              <button
                onClick={() => setSelected({ kind: "all" })}
                className="group flex h-full w-full items-stretch gap-0 overflow-hidden rounded-2xl border border-[var(--color-brand)]/30 bg-[var(--color-brand-soft)] text-left shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="w-1.5 shrink-0 bg-[var(--color-brand)]" />
                <div className="flex flex-1 items-center gap-3 px-4 py-3.5">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--color-brand)] text-white">
                    <Globe className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold tracking-tight text-[var(--color-brand)]">
                      {labels.allProperties}
                    </div>
                    <div className="mt-0.5 text-[11px] text-[var(--color-brand)]/80">
                      {properties.length} properties · {totalReservations}{" "}
                      {labels.reservations.toLowerCase()}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-brand)] transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            </HoverLift>
          </StaggerItem>
        )}

        {properties.map((p) => (
          <StaggerItem key={p.id} className="h-full">
            <HoverLift className="h-full">
              <button
                onClick={() => setSelected({ kind: "one", property: p })}
                className="group flex h-full w-full items-stretch gap-0 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white text-left shadow-sm transition-shadow hover:shadow-md"
              >
                <span
                  className="w-1.5 shrink-0"
                  style={{ background: p.color }}
                />
                <div className="flex flex-1 items-center gap-3 px-4 py-3.5">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold tracking-tight">
                      {p.name}
                    </div>
                    {p.address && (
                      <div className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-[var(--color-muted)]">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{p.address}</span>
                      </div>
                    )}
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--color-muted)]">
                      <CalendarCheck className="h-3 w-3" />
                      <span>
                        {p.reservationCount}{" "}
                        {labels.reservations.toLowerCase()}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-brand)]" />
                </div>
              </button>
            </HoverLift>
          </StaggerItem>
        ))}

        {properties.length === 0 && (
          <Card className="col-span-full grid place-items-center gap-3 px-6 py-14 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
              <Building2 className="h-7 w-7" />
            </div>
            <p className="text-sm text-[var(--color-muted)]">
              {labels.noProperties}
            </p>
          </Card>
        )}
      </StaggerList>

      <Sheet
        open={!!selected}
        onClose={() => setSelected(null)}
        side="right"
        title={
          selected?.kind === "all"
            ? labels.allProperties
            : selected?.property.name
        }
        description={
          selected?.kind === "one"
            ? selected.property.address ?? undefined
            : undefined
        }
      >
        {selected && (
          <PropertyReport
            propertyId={selected.kind === "one" ? selected.property.id : ""}
            scopeName={
              selected.kind === "one"
                ? selected.property.name
                : labels.allProperties
            }
            scopeCreatedAt={
              selected.kind === "one"
                ? selected.property.createdAt
                : earliestCreatedAt
            }
            ownerName={ownerName}
            locale={locale}
            labels={labels}
          />
        )}
      </Sheet>
    </div>
  );
}
