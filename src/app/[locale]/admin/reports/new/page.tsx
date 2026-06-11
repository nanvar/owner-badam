import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/app-shell";
import { monthKeyFor, extractBookingRef } from "@/lib/utils";
import { ReportBuilder } from "./report-builder";
import { BackButton } from "./back-button";

export default async function NewReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  await requireRole("ADMIN");
  const sp = await searchParams;
  const loc = locale as Locale;

  const properties = await prisma.property.findMany({
    select: {
      id: true,
      name: true,
      color: true,
      owner: { select: { id: true, name: true, email: true } },
    },
    orderBy: { name: "asc" },
  });

  const selectedId = sp.propertyId;
  let reservations: Array<{
    id: string;
    bookingRef: string | null;
    checkIn: string;
    checkOut: string;
    nights: number;
    guestName: string | null;
    totalPrice: number;
    agencyCommission: number;
    portalCommission: number;
    payout: number;
    currency: string;
    monthKey: string | null;
  }> = [];
  let extensions: Array<{
    id: string;
    reservationId: string;
    bookingRef: string | null;
    parentGuestName: string | null;
    checkIn: string;
    checkOut: string;
    nights: number;
    totalPrice: number;
    agencyCommission: number;
    portalCommission: number;
    payout: number;
    currency: string;
    monthKey: string | null;
  }> = [];
  let expenses: Array<{
    id: string;
    date: string;
    type: string;
    description: string;
    amount: number;
    monthKey: string | null;
  }> = [];
  if (selectedId && properties.some((p) => p.id === selectedId)) {
    // Only items NOT already attached to a report. Realized only —
    // pending bookings can't be settled with the owner yet. Also restrict
    // to GUEST-PAID rows: a report bundles money the company has actually
    // received; including unpaid items would cause the matching
    // OwnerPayment to overshoot real income → owner-payout swings
    // negative until the guest finally pays. checkIn / date asc so the
    // picker reads chronologically the way an admin scans the month.
    const [r, ext, e] = await Promise.all([
      prisma.reservation.findMany({
        where: {
          propertyId: selectedId,
          reportId: null,
          upcoming: false,
          paid: true,
        },
        orderBy: { checkIn: "asc" },
      }),
      prisma.reservationExtension.findMany({
        where: {
          reportId: null,
          paid: true,
          reservation: { propertyId: selectedId },
        },
        include: {
          reservation: {
            select: {
              externalId: true,
              guestName: true,
              rawDescription: true,
            },
          },
        },
        orderBy: { checkIn: "asc" },
      }),
      // Owner reports bundle every expense recorded against the
      // property — even ones that were paid from invested capital.
      // The owner sees the full picture of what was spent. The
      // "paid from company invest" rows have their own OwnerDebt
      // settling life cycle outside the report.
      prisma.expense.findMany({
        where: { propertyId: selectedId, reportId: null },
        orderBy: { date: "asc" },
      }),
    ]);
    reservations = r.map((row) => ({
      id: row.id,
      bookingRef: extractBookingRef(row.rawDescription),
      checkIn: row.checkIn.toISOString(),
      checkOut: row.checkOut.toISOString(),
      nights: row.nights,
      guestName: row.guestName,
      totalPrice: row.totalPrice,
      agencyCommission: row.agencyCommission,
      portalCommission: row.portalCommission,
      payout: row.payout,
      currency: row.currency,
      monthKey: row.monthKey,
    }));
    extensions = ext.map((row) => ({
      id: row.id,
      reservationId: row.reservationId,
      bookingRef: extractBookingRef(row.reservation.rawDescription),
      parentGuestName: row.reservation.guestName,
      checkIn: row.checkIn.toISOString(),
      checkOut: row.checkOut.toISOString(),
      nights: row.nights,
      totalPrice: row.totalPrice,
      agencyCommission: row.agencyCommission,
      portalCommission: row.portalCommission,
      payout: row.payout,
      currency: row.currency,
      monthKey: row.monthKey,
    }));
    expenses = e.map((row) => ({
      id: row.id,
      date: row.date.toISOString(),
      type: row.type,
      description: row.description,
      amount: row.amount,
      monthKey: row.monthKey,
    }));
  }

  return (
    <div>
      <BackButton fallbackHref={`/${loc}/admin/owners`} />
      <PageHeader title="New report" />
      <ReportBuilder
        locale={loc}
        currentMonthKey={monthKeyFor(new Date())}
        properties={properties.map((p) => ({
          id: p.id,
          name: p.name,
          color: p.color,
          ownerName: p.owner.name ?? p.owner.email,
        }))}
        selectedPropertyId={selectedId ?? null}
        reservations={reservations}
        extensions={extensions}
        expenses={expenses}
      />
    </div>
  );
}
