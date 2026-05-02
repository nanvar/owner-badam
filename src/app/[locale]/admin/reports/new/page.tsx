import { setRequestLocale } from "next-intl/server";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/app-shell";
import { ReportBuilder } from "./report-builder";

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
    checkIn: string;
    checkOut: string;
    nights: number;
    guestName: string | null;
    totalPrice: number;
    payout: number;
    currency: string;
  }> = [];
  let expenses: Array<{
    id: string;
    date: string;
    type: string;
    description: string;
    amount: number;
  }> = [];
  if (selectedId && properties.some((p) => p.id === selectedId)) {
    // Only items NOT already attached to a report. Realized only — pending
    // bookings can't be settled with the owner yet.
    const [r, e] = await Promise.all([
      prisma.reservation.findMany({
        where: {
          propertyId: selectedId,
          reportId: null,
          upcoming: false,
        },
        orderBy: { checkIn: "desc" },
      }),
      prisma.expense.findMany({
        where: { propertyId: selectedId, reportId: null },
        orderBy: { date: "desc" },
      }),
    ]);
    reservations = r.map((row) => ({
      id: row.id,
      checkIn: row.checkIn.toISOString(),
      checkOut: row.checkOut.toISOString(),
      nights: row.nights,
      guestName: row.guestName,
      totalPrice: row.totalPrice,
      payout: row.payout,
      currency: row.currency,
    }));
    expenses = e.map((row) => ({
      id: row.id,
      date: row.date.toISOString(),
      type: row.type,
      description: row.description,
      amount: row.amount,
    }));
  }

  return (
    <div>
      <Link
        href={`/${loc}/admin/reports`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to reports
      </Link>
      <PageHeader title="New report" />
      <ReportBuilder
        locale={loc}
        properties={properties.map((p) => ({
          id: p.id,
          name: p.name,
          color: p.color,
          ownerName: p.owner.name ?? p.owner.email,
        }))}
        selectedPropertyId={selectedId ?? null}
        reservations={reservations}
        expenses={expenses}
      />
    </div>
  );
}
