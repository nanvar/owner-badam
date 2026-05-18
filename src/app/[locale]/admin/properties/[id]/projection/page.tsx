import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { ProjectionEditor } from "./projection-editor";

async function fetchLogoAsDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get("content-type") || "image/png";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

const DEFAULT_LISTING_BULLETS = [
  "Marketing of Property",
  "Professional Photography",
  "List Creation",
  "Daily Price Optimization",
  "DTCM Registration",
].join("\n");

const DEFAULT_GUEST_BULLETS = [
  "Guest Communication",
  "Guest Vetting",
  "Check in",
  "Linen & Toiletries",
  "Concierge Service",
].join("\n");

const DEFAULT_PROPERTY_BULLETS = [
  "Housekeeping",
  "Maintenance",
  "Insurance",
  "Landlord's Dashboard",
  "Monthly Reports",
  "Utility Payment",
  "Furnishing (Extra charge)",
].join("\n");

const DEFAULT_ABOUT =
  "We are a boutique holiday homes rental agency with an experienced hospitality team managing your property end-to-end.";

export default async function PropertyProjectionPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  await requireRole("ADMIN");

  const [property, settings] = await Promise.all([
    prisma.property.findUnique({
      where: { id },
      include: { projection: true },
    }),
    getSettings(),
  ]);
  if (!property) notFound();

  const projection = property.projection;
  const initial = {
    propertyId: property.id,
    propertyName: property.name,
    bedrooms: property.bedrooms ?? 1,
    area: projection?.area || "",
    buildingName: projection?.buildingName || property.name,
    avgMonthlyNet: projection?.avgMonthlyNet ?? 0,
    duMonthly: projection?.duMonthly ?? 380,
    dewaChillerMonthly: projection?.dewaChillerMonthly ?? 650,
    propertyInsuranceYearly: projection?.propertyInsuranceYearly ?? 1200,
    maintenanceMonthly: projection?.maintenanceMonthly ?? 125,
    dtcmPermitYearly: projection?.dtcmPermitYearly ?? 370,
    managementFeePct: projection?.managementFeePct ?? 20,
    vatPct: projection?.vatPct ?? 5,
    portalFeePct: projection?.portalFeePct ?? 10.5,
    pessimisticOccupancy: projection?.pessimisticOccupancy ?? 75,
    realisticOccupancy: projection?.realisticOccupancy ?? 80,
    optimisticOccupancy: projection?.optimisticOccupancy ?? 85,
    pessimisticGross: projection?.pessimisticGross ?? 0,
    realisticGross: projection?.realisticGross ?? 0,
    optimisticGross: projection?.optimisticGross ?? 0,
    listingMgmtBullets:
      projection?.listingMgmtBullets ?? DEFAULT_LISTING_BULLETS,
    guestMgmtBullets:
      projection?.guestMgmtBullets ?? DEFAULT_GUEST_BULLETS,
    propertyMgmtBullets:
      projection?.propertyMgmtBullets ?? DEFAULT_PROPERTY_BULLETS,
    aboutText: projection?.aboutText ?? DEFAULT_ABOUT,
  };

  return (
    <ProjectionEditor
      locale={locale as Locale}
      backHref={`/${locale}/admin/properties`}
      initial={initial}
      brand={{
        name: settings.brandName,
        legalName: settings.legalName,
        logoDataUrl: await fetchLogoAsDataUrl(settings.logoUrl),
        email: settings.email,
        phone: settings.phone,
        website: settings.website,
        address:
          [settings.address, settings.city, settings.country]
            .filter(Boolean)
            .join(", ") || null,
      }}
    />
  );
}
