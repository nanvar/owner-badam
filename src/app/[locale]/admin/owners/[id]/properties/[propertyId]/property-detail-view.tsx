"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BedDouble,
  Bath,
  Users,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  MapPin,
  Bed,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { crawlAirbnbAction, type CrawlState } from "@/app/actions/crawl";
import type { Locale } from "@/i18n/config";

type Property = {
  id: string;
  name: string;
  address: string | null;
  color: string;
  airbnbUrl: string | null;
  airbnbIcalUrl: string | null;
  description: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  beds: number | null;
  maxGuests: number | null;
  amenities: string[];
  photos: { url: string; caption?: string }[];
  crawledAt: string | null;
  reservationCount: number;
};

type Reservation = {
  id: string;
  guestName: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  totalPrice: number;
  payout: number;
  currency: string;
  detailsFilled: boolean;
};

type Labels = {
  edit: string;
  delete: string;
  reservations: string;
  guest: string;
  checkIn: string;
  checkOut: string;
  nights: string;
  totalPrice: string;
  payout: string;
  noReservations: string;
  description: string;
  amenities: string;
  gallery: string;
  stats: string;
  bedrooms: string;
  bathrooms: string;
  beds: string;
  maxGuests: string;
  openOnAirbnb: string;
  crawl: string;
  crawling: string;
  neverCrawled: string;
  lastCrawled: string;
  crawlNeedsUrl: string;
};

export function PropertyDetailView({
  locale,
  property,
  reservations,
  labels,
}: {
  locale: Locale;
  property: Property;
  reservations: Reservation[];
  labels: Labels;
}) {
  const router = useRouter();
  const [crawlState, setCrawlState] = useState<CrawlState | null>(null);
  const [crawling, startCrawl] = useTransition();
  const [lightbox, setLightbox] = useState<number | null>(null);

  const photos = property.photos ?? [];
  const stats = [
    {
      icon: <BedDouble className="h-5 w-5" />,
      label: labels.bedrooms,
      value: property.bedrooms,
    },
    {
      icon: <Bed className="h-5 w-5" />,
      label: labels.beds,
      value: property.beds,
    },
    {
      icon: <Bath className="h-5 w-5" />,
      label: labels.bathrooms,
      value: property.bathrooms,
    },
    {
      icon: <Users className="h-5 w-5" />,
      label: labels.maxGuests,
      value: property.maxGuests,
    },
  ].filter((s) => s.value !== null && s.value !== undefined);

  const onCrawl = () => {
    startCrawl(async () => {
      const r = await crawlAirbnbAction(property.id);
      setCrawlState(r);
      if (r.status === "ok") router.refresh();
    });
  };

  return (
    <div>
      {/* === Title + address === */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <span
              className="mt-2 h-7 w-1.5 shrink-0 rounded-full"
              style={{ background: property.color }}
            />
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                {property.name}
              </h1>
              {property.address && (
                <div className="mt-1 flex items-center gap-1.5 text-sm text-[var(--color-muted)]">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span>{property.address}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {property.airbnbUrl && (
            <a
              href={property.airbnbUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm font-medium text-[var(--color-foreground)] transition-colors hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {labels.openOnAirbnb}
            </a>
          )}
          <Button
            onClick={onCrawl}
            loading={crawling}
            disabled={!property.airbnbUrl}
            title={!property.airbnbUrl ? labels.crawlNeedsUrl : undefined}
          >
            <RefreshCw className="h-4 w-4" />
            {crawling ? labels.crawling : labels.crawl}
          </Button>
        </div>
      </div>

      {/* === Crawl banner === */}
      {crawlState && (
        <div
          className={cn(
            "mb-4 flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm",
            crawlState.status === "ok"
              ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700"
              : "border-rose-500/30 bg-rose-500/5 text-rose-600",
          )}
        >
          {crawlState.status === "ok" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{crawlState.message}</span>
        </div>
      )}

      {/* === Hero gallery — Airbnb-style 1+4 mosaic === */}
      {photos.length > 0 ? (
        <PhotoMosaic
          photos={photos}
          name={property.name}
          onOpen={(idx) => setLightbox(idx)}
        />
      ) : (
        <div className="mb-6 grid place-items-center gap-3 rounded-3xl border border-dashed border-[var(--color-border)] bg-white px-6 py-20 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
            <ImageIcon className="h-7 w-7" />
          </div>
          <p className="max-w-md text-sm text-[var(--color-muted)]">
            {property.airbnbUrl
              ? "No photos imported yet. Click Import from Airbnb above to fetch them."
              : labels.crawlNeedsUrl}
          </p>
        </div>
      )}

      {/* === Stats row === */}
      {stats.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-3 rounded-2xl border border-[var(--color-border)] bg-white p-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={cn(
                "flex items-center gap-3 px-3",
                i > 0 && "border-l border-[var(--color-border)]",
              )}
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
                {s.icon}
              </div>
              <div>
                <div className="text-xl font-bold tabular-nums leading-none">
                  {s.value}
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-wider text-[var(--color-muted)]">
                  {s.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* === Two-column body === */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* LEFT: description + amenities + bookings */}
        <div className="space-y-6">
          {property.description && (
            <section>
              <h2 className="mb-3 text-base font-bold tracking-tight">
                {labels.description}
              </h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--color-foreground)]/85">
                {property.description}
              </p>
            </section>
          )}

          {property.amenities.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-base font-bold tracking-tight">
                <Sparkles className="h-4 w-4 text-[var(--color-brand)]" />
                {labels.amenities}
                <span className="text-xs font-normal text-[var(--color-muted)]">
                  · {property.amenities.length}
                </span>
              </h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                {property.amenities.map((a) => (
                  <div
                    key={a}
                    className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[var(--color-brand)]" />
                    <span className="truncate">{a}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold tracking-tight">
                {labels.reservations}
              </h2>
              <span className="text-xs text-[var(--color-muted)]">
                {property.reservationCount} total
              </span>
            </div>
            {reservations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-white px-4 py-10 text-center text-sm text-[var(--color-muted)]">
                {labels.noReservations}
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white">
                <table className="w-full text-xs">
                  <thead className="bg-[var(--color-surface-2)] text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">
                        {labels.guest}
                      </th>
                      <th className="px-3 py-2 text-left font-semibold">
                        {labels.checkIn} → {labels.checkOut}
                      </th>
                      <th className="px-3 py-2 text-right font-semibold">
                        {labels.totalPrice}
                      </th>
                      <th className="px-3 py-2 text-right font-semibold">
                        {labels.payout}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.map((r) => (
                      <tr
                        key={r.id}
                        className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]/40"
                      >
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">
                              {r.guestName ?? labels.guest}
                            </span>
                            {!r.detailsFilled && <Badge tone="warning">!</Badge>}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-[var(--color-muted)]">
                          {formatDate(r.checkIn, locale)} →{" "}
                          {formatDate(r.checkOut, locale)}{" "}
                          <span className="text-[10px]">· {r.nights}n</span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-[var(--color-muted)]">
                          {formatCurrency(
                            r.totalPrice,
                            r.currency || "AED",
                            locale,
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-bold">
                          {formatCurrency(r.payout, r.currency || "AED", locale)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* RIGHT: floating sidebar with crawl status + meta */}
        <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-2xl border border-[var(--color-border)] bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Airbnb import
              </span>
              {property.crawledAt ? (
                <Badge tone="success">
                  <CheckCircle2 className="h-3 w-3" /> Imported
                </Badge>
              ) : (
                <Badge tone="warning">{labels.neverCrawled}</Badge>
              )}
            </div>
            {property.crawledAt && (
              <div className="mt-2 text-xs text-[var(--color-muted)]">
                {labels.lastCrawled}: {formatDate(property.crawledAt, locale)}
              </div>
            )}
            {property.airbnbUrl && (
              <div className="mt-3 break-all rounded-lg bg-[var(--color-surface-2)] px-2.5 py-2 text-[11px] text-[var(--color-muted)]">
                {new URL(property.airbnbUrl).pathname.replace(/^\/+/, "/")}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-white p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              iCal sync
            </div>
            <div className="mt-1 text-xs">
              {property.airbnbIcalUrl ? (
                <Badge tone="success">configured</Badge>
              ) : (
                <Badge tone="warning">not set</Badge>
              )}
            </div>
          </div>

          {photos.length > 0 && (
            <div className="rounded-2xl border border-[var(--color-border)] bg-white p-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Gallery
              </div>
              <div className="mt-1 text-xl font-bold tabular-nums">
                {photos.length}
                <span className="ml-1 text-xs font-normal text-[var(--color-muted)]">
                  photos
                </span>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <Lightbox
          photos={photos}
          startIndex={lightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

function PhotoMosaic({
  photos,
  name,
  onOpen,
}: {
  photos: { url: string; caption?: string }[];
  name: string;
  onOpen: (idx: number) => void;
}) {
  const main = photos[0];
  const grid = photos.slice(1, 5); // up to 4 secondary tiles
  const remaining = Math.max(0, photos.length - 5);

  if (!main) return null;

  return (
    <div className="mb-6 grid gap-2 overflow-hidden rounded-3xl sm:grid-cols-4 sm:[grid-template-rows:repeat(2,1fr)]">
      <button
        onClick={() => onOpen(0)}
        className="group relative aspect-[16/10] sm:col-span-2 sm:row-span-2 sm:aspect-auto"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={main.url}
          alt={main.caption ?? name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
      </button>
      {grid.map((p, i) => {
        const idx = i + 1;
        const isLastVisible = i === grid.length - 1 && remaining > 0;
        return (
          <button
            key={p.url}
            onClick={() => onOpen(idx)}
            className="group relative hidden aspect-[4/3] sm:block sm:aspect-auto"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.url}
              alt={p.caption ?? ""}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
            {isLastVisible && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-semibold text-white backdrop-blur-[2px]">
                +{remaining} more
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Lightbox({
  photos,
  startIndex,
  onClose,
}: {
  photos: { url: string; caption?: string }[];
  startIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const total = photos.length;
  const prev = () => setIndex((i) => (i - 1 + total) % total);
  const next = () => setIndex((i) => (i + 1) % total);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          prev();
        }}
        className="absolute left-4 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25"
        aria-label="Previous"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          next();
        }}
        className="absolute right-4 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25"
        aria-label="Next"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
      <button
        onClick={onClose}
        className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>
      <div
        className="relative max-h-[90vh] max-w-[92vw]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photos[index].url}
          alt={photos[index].caption ?? ""}
          className="max-h-[90vh] max-w-[92vw] rounded-2xl object-contain"
        />
        <div className="mt-3 text-center text-xs text-white/70">
          {index + 1} / {total}
        </div>
      </div>
    </div>
  );
}
