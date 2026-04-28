"use client";

import { useState } from "react";
import { Building2, ChevronRight, MapPin, CalendarCheck } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { CalendarView } from "./calendar-view";
import { StaggerList, StaggerItem, HoverLift } from "@/components/ui/motion";
import type { Locale } from "@/i18n/config";

type Event = {
  id: string;
  title: string;
  start: string;
  end: string;
  color: string;
  extendedProps: {
    propertyName: string;
    propertyColor: string;
    guestName: string;
    nights: number;
    totalPrice: number;
    currency: string;
    pricePerNight: number;
  };
};

type Property = {
  id: string;
  name: string;
  address: string | null;
  color: string;
  reservationCount: number;
  upcomingCount: number;
  events: Event[];
};

export function PropertyCalendarPicker({
  locale,
  properties,
  labels,
}: {
  locale: Locale;
  properties: Property[];
  labels: {
    title: string;
    noProperties: string;
    upcoming: string;
    reservations: string;
  };
}) {
  const [selected, setSelected] = useState<Property | null>(null);

  if (properties.length === 0) {
    return (
      <div>
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">
          {labels.title}
        </h1>
        <Card className="mt-5 grid place-items-center gap-3 px-6 py-14 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
            <Building2 className="h-7 w-7" />
          </div>
          <p className="text-sm text-[var(--color-muted)]">
            {labels.noProperties}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold tracking-tight md:text-2xl">
        {labels.title}
      </h1>
      <StaggerList className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {properties.map((p) => (
          <StaggerItem key={p.id}>
            <HoverLift>
              <button
                onClick={() => setSelected(p)}
                className="group flex w-full items-stretch gap-0 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white text-left shadow-sm transition-shadow hover:shadow-md"
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
                      <span>{p.reservationCount}</span>
                      {p.upcomingCount > 0 && (
                        <span className="rounded-full bg-[var(--color-brand-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-brand)]">
                          {p.upcomingCount} {labels.upcoming.toLowerCase()}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-brand)]" />
                </div>
              </button>
            </HoverLift>
          </StaggerItem>
        ))}
      </StaggerList>

      <Sheet
        open={!!selected}
        onClose={() => setSelected(null)}
        side="right"
        title={selected?.name}
        description={selected?.address ?? undefined}
      >
        {selected && (
          <CalendarView locale={locale} events={selected.events} embedded />
        )}
      </Sheet>
    </div>
  );
}
