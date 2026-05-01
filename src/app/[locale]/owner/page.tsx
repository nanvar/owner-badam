import { setRequestLocale, getTranslations } from "next-intl/server";
import { isLocale, type Locale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { Clock, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { Card, CardBody } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  buildMonthlySeries,
  computeKpis,
  periodFromRange,
} from "@/lib/metrics";
import { OwnerDashboardView } from "./dashboard-view";

export default async function OwnerDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const session = await requireSession();
  const sp = await searchParams;
  const range = sp.range ?? "this-month";
  const period = periodFromRange(range);

  const ownerFilter =
    session.role === "OWNER" ? { property: { ownerId: session.userId } } : undefined;
  const propertyWhere =
    session.role === "OWNER" ? { ownerId: session.userId } : undefined;

  // Realized reservations only — upcoming is shown separately below so it
  // doesn't skew dashboard KPIs (revenue, occupancy…).
  const [reservations, propertyCount, upcomingAgg, payments] = await Promise.all([
    prisma.reservation.findMany({
      where: { ...(ownerFilter ?? {}), upcoming: false },
      select: {
        nights: true,
        totalPrice: true,
        payout: true,
        cleaningFee: true,
        checkIn: true,
        checkOut: true,
      },
      orderBy: { checkIn: "asc" },
    }),
    prisma.property.count({ where: propertyWhere }),
    prisma.reservation.aggregate({
      where: { ...(ownerFilter ?? {}), upcoming: true },
      _count: { _all: true },
      _sum: { payout: true },
    }),
    session.role === "OWNER"
      ? prisma.ownerPayment.findMany({
          where: { ownerId: session.userId },
          orderBy: { date: "desc" },
          take: 50,
        })
      : Promise.resolve([]),
  ]);
  const upcomingCount = upcomingAgg._count._all;
  const upcomingPayout = upcomingAgg._sum.payout ?? 0;

  const items = reservations.map((r) => ({
    id: "",
    propertyId: "",
    propertyName: "",
    propertyColor: "",
    guestName: null,
    numGuests: null,
    checkIn: r.checkIn,
    checkOut: r.checkOut,
    nights: r.nights,
    pricePerNight: 0,
    totalPrice: r.totalPrice,
    cleaningFee: r.cleaningFee,
    payout: r.payout,
    currency: "AED",
    detailsFilled: false,
  }));

  const kpis = computeKpis(items, propertyCount, period);
  const monthly = buildMonthlySeries(items, propertyCount, 12);

  const t = await getTranslations({ locale, namespace: "owner" });
  const tCommon = await getTranslations({ locale, namespace: "common" });

  const loc = locale as Locale;

  return (
    <>
      <OwnerDashboardView
        locale={loc}
        range={range}
        kpis={{
          revenue: kpis.revenue,
          bookings: kpis.bookings,
          nights: kpis.nights,
          availableNights: kpis.availableNights,
          occupancy: kpis.occupancy,
          adr: kpis.adr,
          revpar: kpis.revpar,
        }}
        monthly={monthly}
        labels={{
          kpiRevenue: t("kpiRevenue"),
          kpiNights: t("kpiNights"),
          kpiOccupancy: t("kpiOccupancy"),
          kpiAdr: t("kpiAdr"),
          kpiRevpar: t("kpiRevpar"),
          kpiBookings: t("kpiBookings"),
          thisMonth: t("thisMonth"),
          lastMonth: t("lastMonth"),
          ytd: t("ytd"),
          last30: t("last30"),
          last90: t("last90"),
          monthlyRevenue: t("monthlyRevenueAll"),
          noData: tCommon("noData"),
        }}
      />

      {session.role === "OWNER" && upcomingCount > 0 && (
        <Card className="mt-6 overflow-hidden">
          <CardBody className="bg-gradient-to-br from-sky-500/15 to-sky-500/0">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-sky-500/15 text-sky-700">
                <Clock className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-sky-700">
                  Upcoming
                </div>
                <div className="text-base font-bold tabular-nums">
                  {upcomingCount} reservation{upcomingCount === 1 ? "" : "s"}
                  <span className="ml-2 text-sm font-medium text-[var(--color-muted)]">
                    · expected payout {formatCurrency(upcomingPayout, "AED", loc)}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-[var(--color-muted)]">
                  Not counted in the figures above — pending payment.
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {session.role === "OWNER" && (
        <div className="mt-6">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold tracking-tight">
            <Wallet className="h-4 w-4 text-[var(--color-brand)]" />
            Payments received
            <span className="text-xs font-normal text-[var(--color-muted)]">
              · total{" "}
              {formatCurrency(
                payments.reduce((s, p) => s + p.amount, 0),
                "AED",
                loc,
              )}
            </span>
          </h2>
          {payments.length === 0 ? (
            <Card>
              <CardBody className="py-8 text-center text-sm text-[var(--color-muted)]">
                No payments recorded yet.
              </CardBody>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--color-surface-2)] text-xs uppercase tracking-wider text-[var(--color-muted)]">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Date</th>
                      <th className="px-4 py-3 text-right font-semibold">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-left font-semibold">
                        Method
                      </th>
                      <th className="px-4 py-3 text-left font-semibold">
                        Reference
                      </th>
                      <th className="px-4 py-3 text-left font-semibold">
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr
                        key={p.id}
                        className="border-t border-[var(--color-border)]"
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          {formatDate(p.date.toISOString(), loc)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums text-emerald-700">
                          {formatCurrency(p.amount, "AED", loc)}
                        </td>
                        <td className="px-4 py-3 text-[var(--color-muted)]">
                          {p.method ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-[var(--color-muted)]">
                          {p.reference ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--color-muted)]">
                          {p.notes ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
