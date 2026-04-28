"use client";

import { useEffect, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg } from "@fullcalendar/core";
import enLocale from "@fullcalendar/core/locales/en-gb";
import ruLocale from "@fullcalendar/core/locales/ru";
import { ChevronLeft, ChevronRight, Grid2x2, List } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { PageHeader } from "@/components/app-shell";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
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

type View = "dayGridMonth" | "listMonth";

export function CalendarView({
  locale,
  events,
  title,
  embedded = false,
}: {
  locale: Locale;
  events: Event[];
  title?: string;
  embedded?: boolean;
}) {
  const [selected, setSelected] = useState<EventClickArg | null>(null);
  const [view, setView] = useState<View>("listMonth");
  const [calTitle, setCalTitle] = useState<string>("");
  const calRef = useRef<FullCalendar | null>(null);

  // Default: list on phones, grid on tablet+. Updates on resize.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => {
      const newView: View = mq.matches ? "dayGridMonth" : "listMonth";
      setView(newView);
      const api = calRef.current?.getApi();
      if (api && api.view.type !== newView) api.changeView(newView);
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const refreshTitle = () => {
    const api = calRef.current?.getApi();
    if (api) setCalTitle(api.view.title);
  };

  const goPrev = () => {
    calRef.current?.getApi().prev();
    refreshTitle();
  };
  const goNext = () => {
    calRef.current?.getApi().next();
    refreshTitle();
  };
  const goToday = () => {
    calRef.current?.getApi().today();
    refreshTitle();
  };
  const switchView = (v: View) => {
    setView(v);
    calRef.current?.getApi().changeView(v);
    refreshTitle();
  };

  return (
    <div className="space-y-4">
      {!embedded && title && <PageHeader title={title} />}

      {/* Custom toolbar — stacks cleanly on mobile */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-2xl border border-[var(--color-border)] bg-white p-1">
          <button
            onClick={goPrev}
            className="grid h-9 w-9 place-items-center rounded-xl text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-foreground)] active:scale-95"
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={goToday}
            className="rounded-xl px-3 py-1.5 text-xs font-semibold text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-foreground)] active:scale-95"
          >
            Today
          </button>
          <button
            onClick={goNext}
            className="grid h-9 w-9 place-items-center rounded-xl text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-foreground)] active:scale-95"
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 min-w-0 truncate text-center text-sm font-bold tracking-tight sm:text-base">
          {calTitle}
        </div>

        <div className="flex items-center gap-1 rounded-2xl border border-[var(--color-border)] bg-white p-1">
          <ViewBtn
            active={view === "listMonth"}
            onClick={() => switchView("listMonth")}
            icon={<List className="h-4 w-4" />}
            label="List"
          />
          <ViewBtn
            active={view === "dayGridMonth"}
            onClick={() => switchView("dayGridMonth")}
            icon={<Grid2x2 className="h-4 w-4" />}
            label="Grid"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white">
        <FullCalendar
          ref={calRef}
          plugins={[dayGridPlugin, listPlugin, interactionPlugin]}
          initialView={view}
          locales={[enLocale, ruLocale]}
          locale={locale === "ru" ? "ru" : "en-gb"}
          headerToolbar={false}
          height="auto"
          firstDay={1}
          fixedWeekCount={false}
          dayMaxEventRows={2}
          events={events}
          datesSet={(arg) => setCalTitle(arg.view.title)}
          eventClick={(info) => {
            info.jsEvent.preventDefault();
            setSelected(info);
          }}
          eventDisplay="block"
          dayHeaderFormat={{ weekday: "short" }}
          listDayFormat={{
            weekday: "long",
            day: "numeric",
            month: "short",
          }}
          listDaySideFormat={false}
          noEventsContent={
            view === "listMonth" ? "No reservations this month" : undefined
          }
        />
      </div>

      <Sheet
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.event.extendedProps.guestName as string | undefined}
        description={
          selected?.event.extendedProps.propertyName as string | undefined
        }
      >
        {selected && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Stat
                label="Check-in"
                value={formatDate(selected.event.start!, locale)}
              />
              <Stat
                label="Check-out"
                value={formatDate(selected.event.end!, locale)}
              />
              <Stat
                label="Nights"
                value={selected.event.extendedProps.nights}
              />
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

function ViewBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition-colors active:scale-95",
        active
          ? "bg-[var(--color-brand)] text-white shadow-sm shadow-emerald-700/25"
          : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]",
      )}
      aria-pressed={active}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
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
