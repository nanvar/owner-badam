import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CalendarCheck,
  MapPin,
  FileText,
} from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app-shell";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatStrip } from "./stat-strip";

export default async function ApartmentDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const session = await requireRole("OWNER");

  const property = await prisma.property.findFirst({
    where: { id, ownerId: session.userId },
    include: {
      reservations: {
        orderBy: { checkIn: "asc" },
      },
    },
  });
  if (!property) notFound();

  const tCommon = await getTranslations({ locale, namespace: "common" });
  const tOwner = await getTranslations({ locale, namespace: "owner" });
  const tAdmin = await getTranslations({ locale, namespace: "admin" });
  const loc = locale as Locale;
  const today = new Date();

  const totalRevenue = property.reservations.reduce((s, r) => s + r.totalPrice, 0);
  const totalNights = property.reservations.reduce((s, r) => s + r.nights, 0);
  const totalBookings = property.reservations.length;
  const adr = totalNights > 0 ? totalRevenue / totalNights : 0;
  const upcomingReservations = property.reservations.filter(
    (r) => r.checkOut >= today,
  );
  const pastReservations = property.reservations
    .filter((r) => r.checkOut < today)
    .reverse();

  return (
    <div>
      <Link
        href={`/${locale}/owner/apartments`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
      >
        <ArrowLeft className="h-4 w-4" />
        {tOwner("myProperties")}
      </Link>

      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span
              className="grid h-10 w-10 place-items-center rounded-2xl text-white"
              style={{ background: property.color }}
            >
              <Building2 className="h-5 w-5" />
            </span>
            {property.name}
          </span>
        }
        subtitle={
          property.address && (
            <span className="flex items-center gap-1 text-sm text-[var(--color-muted)]">
              <MapPin className="h-3.5 w-3.5" />
              {property.address}
            </span>
          )
        }
        right={
          <div className="flex items-center gap-2">
            {property.airbnbIcalUrl ? (
              <Badge tone="success">iCal</Badge>
            ) : (
              <Badge tone="warning">No iCal</Badge>
            )}
            <Link
              href={`/${locale}/owner/reports?propertyId=${property.id}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[var(--color-brand)] px-3 text-sm font-medium text-white shadow-sm shadow-indigo-500/25 hover:bg-[var(--color-brand-hover)]"
            >
              <FileText className="h-4 w-4" />
              {tCommon("reports")}
            </Link>
          </div>
        }
      />

      <StatStrip
        locale={loc}
        revenue={totalRevenue}
        bookings={totalBookings}
        nights={totalNights}
        adr={adr}
        labels={{
          revenue: tOwner("kpiRevenue"),
          bookings: tOwner("kpiBookings"),
          nights: tOwner("kpiNights"),
          adr: tOwner("kpiAdr"),
        }}
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{tCommon("details")}</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3 text-sm">
            <Row label={tOwner("basePrice")} value={formatCurrency(property.basePrice, "AED", loc)} />
            <Row
              label={tOwner("cleaningFee")}
              value={formatCurrency(property.cleaningFee, "AED", loc)}
            />
            <Row
              label={tCommon("lastSynced")}
              value={
                property.lastSyncedAt
                  ? formatDate(property.lastSyncedAt, loc)
                  : tCommon("never")
              }
            />
            {property.notes && (
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[var(--color-muted)]">
                  {tCommon("notes")}
                </div>
                <div className="mt-1 whitespace-pre-wrap text-sm">{property.notes}</div>
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader>
            <CardTitle>
              <CalendarCheck className="-mt-0.5 mr-1 inline h-4 w-4" />
              {tOwner("upcoming")}
            </CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            {upcomingReservations.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-[var(--color-muted)]">
                {tOwner("noUpcoming")}
              </p>
            ) : (
              <ReservationsTable
                rows={upcomingReservations.map((r) => ({
                  id: r.id,
                  guestName: r.guestName,
                  checkIn: r.checkIn,
                  checkOut: r.checkOut,
                  nights: r.nights,
                  totalPrice: r.totalPrice,
                  pricePerNight: r.pricePerNight,
                  currency: r.currency,
                }))}
                locale={loc}
                labels={{
                  guest: tOwner("guest"),
                  checkIn: tAdmin("checkIn"),
                  checkOut: tAdmin("checkOut"),
                  nights: tAdmin("nights"),
                  perNight: tAdmin("pricePerNight"),
                  total: tAdmin("totalPrice"),
                }}
              />
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <CardHeader>
          <CardTitle>
            {tCommon("reservations")} · {tOwner("reportPeriod")}
          </CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {pastReservations.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-[var(--color-muted)]">
              {tCommon("noData")}
            </p>
          ) : (
            <ReservationsTable
              rows={pastReservations.map((r) => ({
                id: r.id,
                guestName: r.guestName,
                checkIn: r.checkIn,
                checkOut: r.checkOut,
                nights: r.nights,
                totalPrice: r.totalPrice,
                pricePerNight: r.pricePerNight,
                currency: r.currency,
              }))}
              locale={loc}
              labels={{
                guest: tOwner("guest"),
                checkIn: tAdmin("checkIn"),
                checkOut: tAdmin("checkOut"),
                nights: tAdmin("nights"),
                perNight: tAdmin("pricePerNight"),
                total: tAdmin("totalPrice"),
              }}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2 last:border-0 last:pb-0">
      <span className="text-[var(--color-muted)]">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function ReservationsTable({
  rows,
  locale,
  labels,
}: {
  rows: {
    id: string;
    guestName: string | null;
    checkIn: Date;
    checkOut: Date;
    nights: number;
    pricePerNight: number;
    totalPrice: number;
    currency: string;
  }[];
  locale: Locale;
  labels: Record<string, string>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-surface-2)] text-xs uppercase tracking-wider text-[var(--color-muted)]">
          <tr>
            <th className="px-5 py-3 text-left font-semibold">{labels.guest}</th>
            <th className="px-4 py-3 text-left font-semibold">{labels.checkIn}</th>
            <th className="px-4 py-3 text-left font-semibold">{labels.checkOut}</th>
            <th className="px-4 py-3 text-right font-semibold">{labels.nights}</th>
            <th className="px-4 py-3 text-right font-semibold">{labels.perNight}</th>
            <th className="px-4 py-3 text-right font-semibold">{labels.total}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-[var(--color-border)]">
              <td className="px-5 py-3">{r.guestName ?? "—"}</td>
              <td className="px-4 py-3 whitespace-nowrap">{formatDate(r.checkIn, locale)}</td>
              <td className="px-4 py-3 whitespace-nowrap">{formatDate(r.checkOut, locale)}</td>
              <td className="px-4 py-3 text-right">{r.nights}</td>
              <td className="px-4 py-3 text-right">
                {formatCurrency(r.pricePerNight, r.currency || "AED", locale)}
              </td>
              <td className="px-4 py-3 text-right font-semibold">
                {formatCurrency(r.totalPrice, r.currency || "AED", locale)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
