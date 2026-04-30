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
        }}
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
