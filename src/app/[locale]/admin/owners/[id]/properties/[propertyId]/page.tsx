import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { PropertyDetailView } from "./property-detail-view";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string; propertyId: string }>;
}) {
  const { locale, id, propertyId } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const property = await prisma.property.findFirst({
    where: { id: propertyId, ownerId: id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { reservations: true } },
      reservations: {
        orderBy: { checkIn: "desc" },
        take: 30,
        select: {
          id: true,
          guestName: true,
          checkIn: true,
          checkOut: true,
          nights: true,
          totalPrice: true,
          payout: true,
          currency: true,
          detailsFilled: true,
        },
      },
    },
  });
  if (!property) notFound();

  // Photos + documents + history + service-charge bundle. Each is
  // its own simple query so the page can render even if one bucket
  // is empty.
  const [adminPhotos, documents, events, scSchedule, scInstances] = await Promise.all([
    prisma.propertyMedia.findMany({
      where: { propertyId, kind: { in: ["PHOTO", "COVER"] } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        url: true,
        kind: true,
        title: true,
        caption: true,
        createdAt: true,
      },
    }),
    prisma.propertyMedia.findMany({
      where: { propertyId, kind: "DOCUMENT" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        url: true,
        fileName: true,
        fileSize: true,
        mimeType: true,
        title: true,
        caption: true,
        createdAt: true,
      },
    }),
    prisma.propertyEvent.findMany({
      where: { propertyId },
      orderBy: { happenedAt: "desc" },
      take: 50,
      include: {
        media: {
          select: { id: true, url: true, mimeType: true },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.serviceChargeSchedule.findUnique({
      where: { propertyId },
    }),
    prisma.serviceChargeInstance.findMany({
      where: { propertyId },
      orderBy: { dueDate: "desc" },
      include: {
        proofs: {
          select: { id: true, url: true, fileName: true, mimeType: true },
        },
      },
    }),
  ]);

  const tCommon = await getTranslations({ locale, namespace: "common" });
  const tAdmin = await getTranslations({ locale, namespace: "admin" });

  return (
    <div>
      <Link
        href={`/${locale}/admin/owners/${id}`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
      >
        <ArrowLeft className="h-4 w-4" />
        {property.owner.name ?? property.owner.email}
      </Link>

      <PropertyDetailView
        locale={locale as Locale}
        property={{
          id: property.id,
          name: property.name,
          address: property.address,
          color: property.color,
          airbnbUrl: property.airbnbUrl,
          airbnbIcalUrl: property.airbnbIcalUrl,
          description: property.description,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          beds: property.beds,
          maxGuests: property.maxGuests,
          amenities: (property.amenities as string[] | null) ?? [],
          photos:
            (property.photos as { url: string; caption?: string }[] | null) ??
            [],
          crawledAt: property.crawledAt
            ? property.crawledAt.toISOString()
            : null,
          reservationCount: property._count.reservations,
          managementOnly: property.managementOnly,
          coverPhotoUrl: property.coverPhotoUrl,
        }}
        adminPhotos={adminPhotos.map((p) => ({
          id: p.id,
          url: p.url,
          kind: p.kind,
          title: p.title,
          caption: p.caption,
          createdAt: p.createdAt.toISOString(),
        }))}
        documents={documents.map((d) => ({
          id: d.id,
          url: d.url,
          fileName: d.fileName,
          fileSize: d.fileSize,
          mimeType: d.mimeType,
          title: d.title,
          caption: d.caption,
          createdAt: d.createdAt.toISOString(),
        }))}
        events={events.map((e) => ({
          id: e.id,
          kind: e.kind,
          title: e.title,
          description: e.description,
          happenedAt: e.happenedAt.toISOString(),
          createdAt: e.createdAt.toISOString(),
          createdByName: e.createdBy?.name ?? e.createdBy?.email ?? null,
          media: e.media.map((m) => ({
            id: m.id,
            url: m.url,
            mimeType: m.mimeType,
          })),
        }))}
        serviceSchedule={
          scSchedule
            ? {
                propertyId: scSchedule.propertyId,
                frequencyMonths: scSchedule.frequencyMonths,
                reminderDaysBefore: scSchedule.reminderDaysBefore,
                firstDueDate: scSchedule.firstDueDate.toISOString(),
                active: scSchedule.active,
              }
            : null
        }
        serviceInstances={scInstances.map((i) => ({
          id: i.id,
          dueDate: i.dueDate.toISOString(),
          status: i.status,
          paidAt: i.paidAt ? i.paidAt.toISOString() : null,
          amount: i.amount,
          notes: i.notes,
          proofs: i.proofs.map((p) => ({
            id: p.id,
            url: p.url,
            fileName: p.fileName,
            mimeType: p.mimeType,
          })),
        }))}
        reservations={property.reservations.map((r) => ({
          id: r.id,
          guestName: r.guestName,
          checkIn: r.checkIn.toISOString(),
          checkOut: r.checkOut.toISOString(),
          nights: r.nights,
          totalPrice: r.totalPrice,
          payout: r.payout,
          currency: r.currency,
          detailsFilled: r.detailsFilled,
        }))}
        labels={{
          edit: tCommon("edit"),
          delete: tCommon("delete"),
          reservations: tCommon("reservations"),
          guest: tAdmin("guestName"),
          checkIn: tAdmin("checkIn"),
          checkOut: tAdmin("checkOut"),
          nights: tAdmin("nights"),
          totalPrice: tAdmin("totalPrice"),
          payout: tAdmin("payout"),
          noReservations: "No reservations yet",
          description: "About this listing",
          amenities: "Amenities",
          gallery: "Photos",
          stats: "Stats",
          bedrooms: "Bedrooms",
          bathrooms: "Bathrooms",
          beds: "Beds",
          maxGuests: "Max guests",
          openOnAirbnb: "Open on Airbnb",
          crawl: "Import from Airbnb",
          crawling: "Importing…",
          neverCrawled: "Never imported",
          lastCrawled: "Last imported",
          crawlNeedsUrl: "Add the Airbnb listing URL first",
        }}
      />
    </div>
  );
}
