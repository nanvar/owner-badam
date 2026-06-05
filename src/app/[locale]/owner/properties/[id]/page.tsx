import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Home,
  Wrench,
  FileText,
  History,
  Image as ImageIcon,
} from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/app-shell";
import { EmptyState } from "@/components/owner/empty-state";
import { OwnerPropertyTimeline } from "./property-timeline";

export default async function OwnerPropertyDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const session = await requireRole("OWNER");

  // Ownership check is the WHERE clause itself — anything else
  // (Phase 7 stay quota, Phase 8 prefs) flows from here.
  const property = await prisma.property.findFirst({
    where: { id, ownerId: session.userId },
    select: {
      id: true,
      name: true,
      address: true,
      color: true,
      managementOnly: true,
      coverPhotoUrl: true,
      photos: true,
      description: true,
      bedrooms: true,
      bathrooms: true,
      beds: true,
      maxGuests: true,
      amenities: true,
    },
  });
  if (!property) notFound();

  const [events, adminPhotos, documents] = await Promise.all([
    prisma.propertyEvent.findMany({
      where: { propertyId: id },
      orderBy: { happenedAt: "desc" },
      take: 100,
      include: {
        media: {
          select: {
            id: true,
            url: true,
            kind: true,
            mimeType: true,
            fileName: true,
          },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.propertyMedia.findMany({
      where: {
        propertyId: id,
        kind: { in: ["PHOTO", "COVER"] },
      },
      orderBy: { createdAt: "desc" },
      take: 24,
      select: { id: true, url: true, kind: true, createdAt: true },
    }),
    prisma.propertyMedia.findMany({
      where: { propertyId: id, kind: "DOCUMENT", eventId: null },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        url: true,
        fileName: true,
        fileSize: true,
        mimeType: true,
        createdAt: true,
      },
    }),
  ]);

  const photosArr =
    (property.photos as { url: string; caption?: string }[] | null) ?? [];
  const cover =
    property.coverPhotoUrl ||
    (photosArr.length > 0 ? photosArr[0].url : null);

  return (
    <div className="space-y-3">
      <Link
        href={`/${locale}/owner/properties`}
        className="inline-flex h-9 items-center gap-1 self-start rounded-full border border-[var(--color-border)] bg-white px-3 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All properties
      </Link>

      {/* Hero header — cover photo background, compact overlay copy. */}
      <div
        className="relative overflow-hidden rounded-[24px]"
        style={{ background: property.color, minHeight: 200 }}
      >
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={property.name}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="relative flex h-full flex-col justify-end px-4 py-5 text-white sm:px-5 sm:py-6">
          {property.managementOnly && (
            <span className="mb-2 inline-flex self-start rounded-full bg-orange-500/90 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
              Management only
            </span>
          )}
          <h1 className="text-xl font-bold leading-tight sm:text-2xl">
            {property.name}
          </h1>
          {property.address && (
            <div className="mt-0.5 truncate text-xs text-white/85">
              {property.address}
            </div>
          )}
        </div>
      </div>

      {/* Listing essentials */}
      {(property.bedrooms !== null ||
        property.bathrooms !== null ||
        property.beds !== null ||
        property.maxGuests !== null) && (
        <Card>
          <CardBody className="flex flex-wrap gap-4 text-sm">
            {property.bedrooms !== null && (
              <StatChip label="Bedrooms" value={property.bedrooms} />
            )}
            {property.beds !== null && (
              <StatChip label="Beds" value={property.beds} />
            )}
            {property.bathrooms !== null && (
              <StatChip label="Bathrooms" value={property.bathrooms} />
            )}
            {property.maxGuests !== null && (
              <StatChip label="Max guests" value={property.maxGuests} />
            )}
          </CardBody>
        </Card>
      )}

      {/* Photo gallery — admin-uploaded photos + Airbnb-synced ones */}
      {(adminPhotos.length > 0 || photosArr.length > 0) && (
        <Card>
          <CardBody className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              <ImageIcon className="h-4 w-4" />
              Photos
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {[
                ...adminPhotos.map((p) => p.url),
                ...photosArr.map((p) => p.url),
              ]
                .slice(0, 16)
                .map((url, i) => (
                  <a
                    key={url + i}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="aspect-square overflow-hidden rounded-xl"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt=""
                      className="h-full w-full object-cover transition-transform hover:scale-105"
                    />
                  </a>
                ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Standalone documents — files not attached to a log entry */}
      {documents.length > 0 && (
        <Card>
          <CardBody className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              <FileText className="h-4 w-4" />
              Documents
            </div>
            <ul className="divide-y divide-[var(--color-border)]">
              {documents.map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-2.5">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--color-surface-2)] text-[var(--color-muted)]">
                    <FileText className="h-4 w-4" />
                  </div>
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block min-w-0 flex-1 truncate text-sm font-medium hover:text-[var(--color-brand)]"
                  >
                    {d.fileName ||
                      d.url.split("/").pop() ||
                      "Untitled document"}
                  </a>
                  <span className="text-[11px] text-[var(--color-muted)]">
                    {new Date(d.createdAt).toLocaleDateString(locale)}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {/* Visit log timeline */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center gap-2 px-1 text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          <History className="h-4 w-4" />
          Visit log
        </div>
        {events.length === 0 ? (
          <EmptyState
            title="No visits logged yet"
            description="When our team visits the property — for maintenance, inspections or fixes — a log entry shows up here with photos and notes."
            illustration="/illustrations/owner-visits-empty.svg"
            icon={<Wrench className="h-7 w-7" />}
          />
        ) : (
          <OwnerPropertyTimeline
            locale={locale as Locale}
            events={events.map((e) => ({
              id: e.id,
              kind: e.kind,
              title: e.title,
              description: e.description,
              happenedAt: e.happenedAt.toISOString(),
              createdAt: e.createdAt.toISOString(),
              createdByName:
                e.createdBy?.name ?? e.createdBy?.email ?? null,
              media: e.media.map((m) => ({
                id: m.id,
                url: m.url,
                kind: m.kind,
                mimeType: m.mimeType,
                fileName: m.fileName,
              })),
            }))}
          />
        )}
      </div>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-surface-2)] px-3 py-1.5 text-xs">
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="text-[var(--color-muted)]">{label}</span>
    </div>
  );
}
