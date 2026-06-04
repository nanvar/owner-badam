import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { StayRequestsView } from "./stay-requests-view";

export default async function StayRequestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  await requireRole("ADMIN");

  const sp = await searchParams;
  const tab =
    sp.tab === "APPROVED" || sp.tab === "REJECTED" || sp.tab === "CANCELLED"
      ? sp.tab
      : "PENDING";

  const [pendingCount, approvedCount, rejectedCount, cancelledCount, rows] =
    await Promise.all([
      prisma.ownerReservationRequest.count({ where: { status: "PENDING" } }),
      prisma.ownerReservationRequest.count({ where: { status: "APPROVED" } }),
      prisma.ownerReservationRequest.count({ where: { status: "REJECTED" } }),
      prisma.ownerReservationRequest.count({ where: { status: "CANCELLED" } }),
      prisma.ownerReservationRequest.findMany({
        where: { status: tab },
        orderBy:
          tab === "PENDING"
            ? { createdAt: "asc" }
            : tab === "APPROVED"
              ? { decidedAt: "desc" }
              : { decidedAt: "desc" },
        include: {
          property: { select: { id: true, name: true, color: true } },
          owner: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

  return (
    <StayRequestsView
      locale={locale as Locale}
      tab={tab}
      basePath={`/${locale}/admin/stay-requests`}
      counts={{
        PENDING: pendingCount,
        APPROVED: approvedCount,
        REJECTED: rejectedCount,
        CANCELLED: cancelledCount,
      }}
      entries={rows.map((r) => ({
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
        ownerName: r.owner.name ?? r.owner.email,
      }))}
    />
  );
}
