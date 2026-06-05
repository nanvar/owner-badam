"use client";

// Owner-facing chronological feed of admin-logged visits / events on
// a single property. Photos render inline, documents become download
// chips. Tap a photo to open it full-size in a new tab.

import { useState } from "react";
import {
  Wrench,
  Sparkles,
  Hammer,
  Camera,
  ShieldCheck,
  AlertTriangle,
  FileText,
  StickyNote,
  Sofa,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/motion";
import { cn, formatDate } from "@/lib/utils";
import type { Locale } from "@/i18n/config";

export type Media = {
  id: string;
  url: string;
  kind: string;
  mimeType: string | null;
  fileName: string | null;
};

export type Event = {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  happenedAt: string;
  createdAt: string;
  createdByName: string | null;
  media: Media[];
};

const KIND_META: Record<
  string,
  { label: string; icon: React.ReactNode; tone: string }
> = {
  VISIT: { label: "Site visit", icon: <Sparkles className="h-4 w-4" />, tone: "indigo" },
  INSPECTION: {
    label: "Inspection",
    icon: <ShieldCheck className="h-4 w-4" />,
    tone: "sky",
  },
  MAINTENANCE: {
    label: "Maintenance",
    icon: <Wrench className="h-4 w-4" />,
    tone: "amber",
  },
  RENOVATION: {
    label: "Renovation",
    icon: <Hammer className="h-4 w-4" />,
    tone: "amber",
  },
  FURNISHING: {
    label: "Furnishing",
    icon: <Sofa className="h-4 w-4" />,
    tone: "emerald",
  },
  DAMAGE: {
    label: "Damage / issue",
    icon: <AlertTriangle className="h-4 w-4" />,
    tone: "rose",
  },
  PHOTOGRAPHY: {
    label: "Photography",
    icon: <Camera className="h-4 w-4" />,
    tone: "emerald",
  },
  NOTE: {
    label: "Note",
    icon: <StickyNote className="h-4 w-4" />,
    tone: "indigo",
  },
  OTHER: { label: "Update", icon: <FileText className="h-4 w-4" />, tone: "slate" },
};

const TONE_BG: Record<string, string> = {
  sky: "bg-sky-500/15 text-sky-700 border-sky-500/30",
  emerald: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  indigo: "bg-indigo-500/15 text-indigo-700 border-indigo-500/30",
  rose: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  amber: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  slate: "bg-slate-500/15 text-slate-700 border-slate-500/30",
};

function dayLabel(iso: string, locale: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
    return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  )
    return "Yesterday";
  return formatDate(iso, locale);
}

export function OwnerPropertyTimeline({
  locale,
  events,
}: {
  locale: Locale;
  events: Event[];
}) {
  const [lightbox, setLightbox] = useState<string | null>(null);

  // Group by happenedAt day for the rail.
  const groups: { label: string; events: Event[] }[] = [];
  for (const e of events) {
    const label = dayLabel(e.happenedAt, locale);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.events.push(e);
    else groups.push({ label, events: [e] });
  }

  return (
    <>
      <div className="space-y-5">
        {groups.map((g, gi) => (
          <FadeIn key={g.label + gi} delay={gi * 0.04}>
            <div>
              <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                {g.label}
              </div>
              <div className="space-y-2">
                {g.events.map((e) => (
                  <TimelineCard
                    key={e.id}
                    event={e}
                    locale={locale}
                    onPhotoClick={setLightbox}
                  />
                ))}
              </div>
            </div>
          </FadeIn>
        ))}
      </div>

      {lightbox && <Lightbox url={lightbox} onClose={() => setLightbox(null)} />}
    </>
  );
}

function TimelineCard({
  event,
  locale,
  onPhotoClick,
}: {
  event: Event;
  locale: Locale;
  onPhotoClick: (url: string) => void;
}) {
  const meta = KIND_META[event.kind] ?? KIND_META.OTHER;
  const photos = event.media.filter((m) =>
    (m.mimeType ?? "").startsWith("image/"),
  );
  const documents = event.media.filter(
    (m) => !(m.mimeType ?? "").startsWith("image/"),
  );
  const [expanded, setExpanded] = useState(false);
  const longDesc = event.description && event.description.length > 240;

  return (
    <Card className="overflow-hidden">
      <CardBody className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-xl border",
                TONE_BG[meta.tone],
              )}
            >
              {meta.icon}
            </span>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                {meta.label}
              </div>
              <h3 className="text-base font-semibold leading-tight">
                {event.title}
              </h3>
              {event.createdByName && (
                <div className="mt-0.5 text-[11px] text-[var(--color-muted)]">
                  Logged by {event.createdByName}
                </div>
              )}
            </div>
          </div>
          <div className="shrink-0 text-right text-[11px] text-[var(--color-muted)]">
            {formatDate(event.happenedAt, locale)}
          </div>
        </div>

        {event.description && (
          <div>
            <p
              className={cn(
                "whitespace-pre-wrap text-sm text-[var(--color-foreground)]/85",
                !expanded && longDesc && "line-clamp-4",
              )}
            >
              {event.description}
            </p>
            {longDesc && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-brand)] hover:underline"
              >
                {expanded ? (
                  <>
                    Show less <ChevronUp className="h-3 w-3" />
                  </>
                ) : (
                  <>
                    Show more <ChevronDown className="h-3 w-3" />
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {photos.length > 0 && (
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {photos.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onPhotoClick(m.url)}
                className="aspect-square overflow-hidden rounded-xl"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.url}
                  alt=""
                  className="h-full w-full object-cover transition-transform hover:scale-105"
                />
              </button>
            ))}
          </div>
        )}

        {documents.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {documents.map((m) => (
              <a
                key={m.id}
                href={m.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-surface-2)] px-2.5 py-1 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-brand-soft)] hover:text-[var(--color-brand)]"
              >
                <FileText className="h-3.5 w-3.5" />
                {m.fileName ?? "Attachment"}
              </a>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[9999] grid place-items-center bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
      >
        <X className="h-5 w-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] max-w-[92vw] rounded-2xl object-contain"
      />
    </div>
  );
}
