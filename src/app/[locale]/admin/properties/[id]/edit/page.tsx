import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PropertyForm } from "../../property-form";

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  await requireRole("ADMIN");

  const [property, owners] = await Promise.all([
    prisma.property.findUnique({ where: { id } }),
    prisma.user.findMany({
      where: { role: "OWNER" },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
    }),
  ]);
  if (!property) notFound();

  return (
    <PropertyForm
      locale={locale}
      owners={owners}
      initial={{
        id: property.id,
        name: property.name,
        address: property.address,
        airbnbIcalUrl: property.airbnbIcalUrl,
        airbnbUrl: property.airbnbUrl,
        color: property.color,
        notes: property.notes,
        managementOnly: property.managementOnly,
        coverPhotoUrl: property.coverPhotoUrl,
        ownerId: property.ownerId,
        createdAt: property.createdAt.toISOString(),
      }}
    />
  );
}
