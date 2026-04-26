"use client";

import { useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg } from "@fullcalendar/core";
import enLocale from "@fullcalendar/core/locales/en-gb";
import ruLocale from "@fullcalendar/core/locales/ru";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { PageHeader } from "@/components/app-shell";
import { formatCurrency, formatDate } from "@/lib/utils";
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

export function CalendarView({
  locale,
  events,
  title,
}: {
  locale: Locale;
  events: Event[];
  title: string;
}) {
  const [selected, setSelected] = useState<EventClickArg | null>(null);

  return (
    <div>
      <PageHeader title={title} />
      <Card className="overflow-hidden p-2 sm:p-4">
        <FullCalendar
          plugins={[dayGridPlugin, listPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locales={[enLocale, ruLocale]}
          locale={locale === "ru" ? "ru" : "en-gb"}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,listMonth",
          }}
          height="auto"
          contentHeight={620}
          firstDay={1}
          fixedWeekCount={false}
          dayMaxEventRows={3}
          events={events}
          eventClick={(info) => {
            info.jsEvent.preventDefault();
            setSelected(info);
          }}
          eventDisplay="block"
          dayHeaderFormat={{ weekday: "short" }}
          buttonText={{ today: "Today", month: "Month", list: "List" }}
        />
      </Card>

      <Sheet
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.event.extendedProps.guestName as string | undefined}
        description={selected?.event.extendedProps.propertyName as string | undefined}
      >
        {selected && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Check-in" value={formatDate(selected.event.start!, locale)} />
              <Stat label="Check-out" value={formatDate(selected.event.end!, locale)} />
              <Stat label="Nights" value={selected.event.extendedProps.nights} />
              <Stat
                label="Per night"
                value={formatCurrency(
                  selected.event.extendedProps.pricePerNight as number,
                  (selected.event.extendedProps.currency as string) || "AED",
                  locale,
                )}
              />
            </div>
            <div className="rounded-2xl bg-[var(--color-brand-soft)] p-4 text-center">
              <div className="text-xs uppercase tracking-wider text-[var(--color-brand)]">
                Total
              </div>
              <div className="mt-1 text-2xl font-bold text-[var(--color-brand)]">
                {formatCurrency(
                  selected.event.extendedProps.totalPrice as number,
                  (selected.event.extendedProps.currency as string) || "AED",
                  locale,
                )}
              </div>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-[var(--color-surface-2)] p-3">
      <div className="text-[11px] uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  );
}
