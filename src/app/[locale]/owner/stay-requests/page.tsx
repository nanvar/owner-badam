import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { computeQuotaStatus } from "@/lib/stay-quota";
import { OwnerStayRequestsView } from "./stay-requests-view";

export default async function OwnerStayRequestsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const session = await requireRole("OWNER");

  const [properties, requests] = await Promise.all([
    prisma.property.findMany({
      where: { ownerId: session.userId },
      orderBy: { name: "asc" },
      include: { stayQuota: true },
    }),
    prisma.ownerReservationRequest.findMany({
      where: { ownerId: session.userId },
      orderBy: { createdAt: "desc" },
      include: { property: { select: { id: true, name: true, color: true } } },
    }),
  ]);

  const propsWithQuota = await Promise.all(
    properties.map(async (p) => {
      const status = p.stayQuota ? await computeQuotaStatus(p.id) : null;
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        hasQuota: !!p.stayQuota,
        quota: status
          ? {
              daysPerYear: status.daysPerYear,
              usedNights: status.usedNights,
              pendingNights: status.pendingNights,
              remainingNights: status.remainingNights,
              cycleStart: status.cycleStart.toISOString(),
              cycleEnd: status.cycleEnd.toISOString(),
            }
          : null,
      };
    }),
  );

  return (
    <OwnerStayRequestsView
      locale={locale as Locale}
      properties={propsWithQuota}
      requests={requests.map((r) => ({
        id: r.id,
        status: r.status,
        checkIn: r.checkIn.toISOString(),
        checkOut: r.checkOut.toISOString(),
        nights: r.nights,
        notes: r.notes,
        decidedAt: r.decidedAt?.toISOString() ?? null,
        decisionNote: r.decisionNote,
        createdAt: r.createdAt.toISOString(),
        property: r.property,
      }))}
    />
  );
}
