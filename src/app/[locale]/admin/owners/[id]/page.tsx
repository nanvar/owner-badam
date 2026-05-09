import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, CalendarCheck, Coins, User, Mail } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/app-shell";
import { formatCurrency, monthKeyFor, monthLabel } from "@/lib/utils";
import { MonthSelector } from "../../company/month-selector";

export default async function OwnerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const sp = await searchParams;

  const owner = await prisma.user.findUnique({
    where: { id },
    include: {
      properties: { select: { id: true } },
    },
  });
  if (!owner || owner.role !== "OWNER") notFound();

  const propertyIds = owner.properties.map((p) => p.id);

  // Same union the rest of the admin section surfaces so the picker
  // reads identically. Restricted to this owner's tables so empty months
  // for them don't appear.
  const [resMonths, expMonths, payMonths] = await Promise.all([
    propertyIds.length
      ? prisma.reservation.findMany({
          where: { propertyId: { in: propertyIds }, monthKey: { not: null } },
          select: { monthKey: true },
          distinct: ["monthKey"],
        })
      : Promise.resolve([]),
    propertyIds.length
      ? prisma.expense.findMany({
          where: { propertyId: { in: propertyIds }, monthKey: { not: null } },
          select: { monthKey: true },
          distinct: ["monthKey"],
        })
      : Promise.resolve([]),
    prisma.ownerPayment.findMany({
      where: { ownerId: owner.id, monthKey: { not: null } },
      select: { monthKey: true },
      distinct: ["monthKey"],
    }),
  ]);
  const currentMonth = monthKeyFor(new Date());
  const monthSet = new Set<string>([currentMonth]);
  for (const r of resMonths) if (r.monthKey) monthSet.add(r.monthKey);
  for (const r of expMonths) if (r.monthKey) monthSet.add(r.monthKey);
  for (const r of payMonths) if (r.monthKey) monthSet.add(r.monthKey);
  const monthOpts = [...monthSet]
    .sort()
    .reverse()
    .map((k) => ({ key: k, label: monthLabel(k, locale) }));
  const selectedMonth =
    sp.month && monthSet.has(sp.month) ? sp.month : currentMonth;

  // All KPI numbers scoped to the selected billing month so the page
  // reads as the owner's slice of that period.
  const [reservationAgg, expenseAgg, paymentAgg] = await Promise.all([
    propertyIds.length
      ? prisma.reservation.aggregate({
          where: {
            propertyId: { in: propertyIds },
            monthKey: selectedMonth,
          },
          _sum: { payout: true, nights: true },
          _count: { _all: true },
        })
      : Promise.resolve({
          _sum: { payout: 0, nights: 0 },
          _count: { _all: 0 },
        } as const),
    propertyIds.length
      ? prisma.expense.aggregate({
          where: {
            propertyId: { in: propertyIds },
            monthKey: selectedMonth,
          },
          _sum: { amount: true },
        })
      : Promise.resolve({ _sum: { amount: 0 } } as const),
    prisma.ownerPayment.aggregate({
      where: { ownerId: owner.id, monthKey: selectedMonth },
      _sum: { amount: true },
    }),
  ]);

  const tCommon = await getTranslations({ locale, namespace: "common" });
  const tAdmin = await getTranslations({ locale, namespace: "admin" });
  const tOwner = await getTranslations({ locale, namespace: "owner" });

  const totalReservations = reservationAgg._count._all;
  const accruedPayout = reservationAgg._sum.payout ?? 0;
  const totalNights = reservationAgg._sum.nights ?? 0;
  const totalExpenses = expenseAgg._sum.amount ?? 0;
  const totalPaid = paymentAgg._sum.amount ?? 0;
  // No clamp — when expenses + paid settlements exceed accrued payout
  // the balance is negative and the dashboard should reflect that.
  const ownerPayout = accruedPayout - totalExpenses - totalPaid;

  const loc = locale as Locale;
  const basePath = `/${locale}/admin/owners/${owner.id}`;

  return (
    <div>
      <div className="mb-4">
        <MonthSelector
          options={monthOpts}
          selected={selectedMonth}
          basePath={basePath}
        />
      </div>

      <Link
        href={`/${locale}/admin/owners`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
      >
        <ArrowLeft className="h-4 w-4" />
        {tAdmin("navOwners")}
      </Link>

      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
              <User className="h-5 w-5" />
            </span>
            {owner.name ?? owner.email}
          </span>
        }
        subtitle={
          <span className="flex items-center gap-1 text-sm text-[var(--color-muted)]">
            <Mail className="h-3.5 w-3.5" />
            {owner.email}
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label={tCommon("properties")}
          value={owner.properties.length}
          icon={<Building2 className="h-4 w-4" />}
          accent="indigo"
        />
        <StatCard
          label={tCommon("reservations")}
          value={totalReservations}
          icon={<CalendarCheck className="h-4 w-4" />}
          accent="sky"
        />
        <StatCard
          label={tOwner("kpiNights")}
          value={totalNights}
          accent="emerald"
        />
        <StatCard
          label="Owner payout"
          value={formatCurrency(ownerPayout, "AED", loc)}
          icon={<Coins className="h-4 w-4" />}
          accent={ownerPayout >= 0 ? "amber" : "rose"}
        />
      </div>
    </div>
  );
}
