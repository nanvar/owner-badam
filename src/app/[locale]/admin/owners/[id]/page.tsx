import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Fragment } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Coins,
  Receipt,
  TrendingUp,
  User,
  Mail,
  Wallet,
} from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/app-shell";
import { formatCurrency, monthLabel } from "@/lib/utils";
import { MonthSelector } from "../../company/month-selector";
import { UnpaidCard } from "../../company/unpaid-card";
import { PendingExtensionsCard } from "../../company/pending-extensions-card";

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
  const propertyFilter =
    propertyIds.length > 0 ? { propertyId: { in: propertyIds } } : undefined;

  // Distinct months that actually carry data for this owner. Owner page
  // defaults to "All months" so the cards read as a global snapshot.
  const [resMonths, expMonths, payMonths] = await Promise.all([
    propertyFilter
      ? prisma.reservation.findMany({
          where: { ...propertyFilter, monthKey: { not: null } },
          select: { monthKey: true },
          distinct: ["monthKey"],
        })
      : Promise.resolve([]),
    propertyFilter
      ? prisma.expense.findMany({
          where: { ...propertyFilter, monthKey: { not: null } },
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
  const monthSet = new Set<string>();
  for (const r of resMonths) if (r.monthKey) monthSet.add(r.monthKey);
  for (const r of expMonths) if (r.monthKey) monthSet.add(r.monthKey);
  for (const r of payMonths) if (r.monthKey) monthSet.add(r.monthKey);
  const monthOpts = [...monthSet]
    .sort()
    .reverse()
    .map((k) => ({ key: k, label: monthLabel(k, locale) }));
  const selectedMonth =
    sp.month && monthSet.has(sp.month) ? sp.month : "";
  const monthWhere = selectedMonth ? { monthKey: selectedMonth } : {};

  // === Aggregations ===
  // Realized revenue / payout only count paid reservations + extensions,
  // matching the dashboard rule. Unpaid items still surface in their own
  // drawer so the admin can chase them.
  const today = new Date();
  const [
    paidReservationAgg,
    allReservationsCount,
    activeReservationsCount,
    doneReservationsCount,
    extensionRows,
    expenseAgg,
    paymentAgg,
    unpaidReservationRows,
  ] = await Promise.all([
    propertyFilter
      ? prisma.reservation.aggregate({
          where: { ...propertyFilter, ...monthWhere, paid: true },
          _sum: {
            totalPrice: true,
            payout: true,
          },
          _count: { _all: true },
        })
      : Promise.resolve({
          _sum: { totalPrice: 0, payout: 0 },
          _count: { _all: 0 },
        } as const),
    propertyFilter
      ? prisma.reservation.count({ where: { ...propertyFilter, ...monthWhere } })
      : Promise.resolve(0),
    propertyFilter
      ? prisma.reservation.count({
          where: {
            ...propertyFilter,
            ...monthWhere,
            checkIn: { lte: today },
            checkOut: { gt: today },
          },
        })
      : Promise.resolve(0),
    propertyFilter
      ? prisma.reservation.count({
          where: {
            ...propertyFilter,
            ...monthWhere,
            checkOut: { lte: today },
          },
        })
      : Promise.resolve(0),
    propertyFilter
      ? prisma.reservationExtension.findMany({
          where: {
            ...monthWhere,
            reservation: propertyFilter,
          },
          include: {
            reservation: {
              select: {
                guestName: true,
                property: { select: { name: true, color: true } },
              },
            },
          },
          orderBy: { checkIn: "desc" },
        })
      : Promise.resolve([]),
    propertyFilter
      ? prisma.expense.aggregate({
          where: { ...propertyFilter, ...monthWhere },
          _sum: { amount: true },
        })
      : Promise.resolve({ _sum: { amount: 0 } } as const),
    prisma.ownerPayment.aggregate({
      where: { ownerId: owner.id, ...monthWhere },
      _sum: { amount: true },
    }),
    propertyFilter
      ? prisma.reservation.findMany({
          where: {
            ...propertyFilter,
            ...monthWhere,
            paid: false,
            totalPrice: { gt: 0 },
          },
          include: {
            property: { select: { name: true, color: true } },
          },
          orderBy: { checkIn: "desc" },
        })
      : Promise.resolve([]),
  ]);

  // Roll extension figures into the same buckets as reservations so the
  // KPIs reflect the full picture. Paid-only for revenue/payout, all for
  // counts/pending detection.
  let extensionPaidRevenue = 0;
  let extensionPaidPayout = 0;
  for (const e of extensionRows) {
    if (e.paid) {
      extensionPaidRevenue += e.totalPrice;
      extensionPaidPayout += e.payout;
    }
  }
  const totalExtensionsCount = extensionRows.length;
  const pendingExtensions = extensionRows
    .filter((e) => !e.detailsFilled || e.totalPrice <= 0)
    .map((e) => ({
      id: e.id,
      propertyName: e.reservation.property.name,
      propertyColor: e.reservation.property.color,
      guestName: e.reservation.guestName,
      checkIn: e.checkIn.toISOString(),
      checkOut: e.checkOut.toISOString(),
      nights: e.nights,
    }));
  const pendingExtensionsCount = pendingExtensions.length;

  // Unpaid drawer = reservations + extensions still owing money.
  const unpaidReservations = [
    ...unpaidReservationRows.map((r) => ({
      id: r.id,
      kind: "reservation" as const,
      propertyName: r.property.name,
      propertyColor: r.property.color,
      guestName: r.guestName,
      checkIn: r.checkIn.toISOString(),
      checkOut: r.checkOut.toISOString(),
      totalPrice: r.totalPrice,
      currency: r.currency,
    })),
    ...extensionRows
      .filter((e) => !e.paid && e.totalPrice > 0)
      .map((e) => ({
        id: e.id,
        kind: "extension" as const,
        propertyName: e.reservation.property.name,
        propertyColor: e.reservation.property.color,
        guestName: e.reservation.guestName,
        checkIn: e.checkIn.toISOString(),
        checkOut: e.checkOut.toISOString(),
        totalPrice: e.totalPrice,
        currency: e.currency,
      })),
  ].sort((a, b) => (a.checkIn < b.checkIn ? 1 : -1));
  const unpaidTotal = unpaidReservations.reduce(
    (s, r) => s + r.totalPrice,
    0,
  );
  const unpaidCount = unpaidReservations.length;

  const tCommon = await getTranslations({ locale, namespace: "common" });
  const tAdmin = await getTranslations({ locale, namespace: "admin" });

  const totalReservations = allReservationsCount;
  const realizedRevenue =
    (paidReservationAgg._sum.totalPrice ?? 0) + extensionPaidRevenue;
  const realizedPayout =
    (paidReservationAgg._sum.payout ?? 0) + extensionPaidPayout;
  const totalExpenses = expenseAgg._sum.amount ?? 0;
  const totalPaid = paymentAgg._sum.amount ?? 0;
  // No clamp — when expenses + settlements exceed realized payout the
  // balance is negative (owner owes the company).
  const ownerOutstanding = realizedPayout - totalExpenses - totalPaid;

  const loc = locale as Locale;
  const basePath = `/${locale}/admin/owners/${owner.id}`;

  return (
    <div>
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
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
              <Building2 className="h-3 w-3" />
              {owner.properties.length} {owner.properties.length === 1 ? "property" : "properties"}
            </span>
          </span>
        }
        right={
          <MonthSelector
            options={monthOpts}
            selected={selectedMonth}
            basePath={basePath}
            allowAll
          />
        }
      />

      {/* Top row — 4 single-value tiles */}
      <div className="grid auto-rows-fr grid-cols-2 gap-3 *:h-full md:grid-cols-4">
        <KpiTile
          label="Revenue"
          value={formatCurrency(realizedRevenue, "AED", loc)}
          accent="emerald"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <KpiTile
          label="Owner share"
          value={formatCurrency(realizedPayout, "AED", loc)}
          accent="indigo"
          icon={<Coins className="h-4 w-4" />}
        />
        <KpiTile
          label="Expenses"
          value={formatCurrency(totalExpenses, "AED", loc)}
          accent="rose"
          icon={<Receipt className="h-4 w-4" />}
        />
        <KpiTile
          label="Settlements paid"
          value={formatCurrency(totalPaid, "AED", loc)}
          accent="sky"
          icon={<Wallet className="h-4 w-4" />}
        />
      </div>

      {/* Bottom row */}
      <div className="mt-3 grid auto-rows-fr grid-cols-1 gap-3 *:h-full md:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label={ownerOutstanding >= 0 ? "Outstanding to owner" : "Owner owes us"}
          value={formatCurrency(Math.abs(ownerOutstanding), "AED", loc)}
          accent={ownerOutstanding >= 0 ? "amber" : "rose"}
          icon={<Coins className="h-4 w-4" />}
        />
        <UnpaidCard
          locale={loc}
          total={unpaidTotal}
          count={unpaidCount}
          reservations={unpaidReservations}
        />
        <PendingExtensionsCard
          locale={loc}
          count={pendingExtensionsCount}
          extensions={pendingExtensions}
        />
        <DualValueTile
          label={tCommon("reservations")}
          icon={<CalendarDays className="h-4 w-4" />}
          accent="amber"
          values={[
            { label: "All", value: String(totalReservations) },
            { label: "Live", value: String(activeReservationsCount) },
            { label: "Done", value: String(doneReservationsCount) },
            { label: "Ext", value: String(totalExtensionsCount) },
          ]}
        />
      </div>
    </div>
  );
}

function KpiTile({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent: "emerald" | "rose" | "indigo" | "amber" | "sky";
  icon: React.ReactNode;
}) {
  const accentMap: Record<typeof accent, string> = {
    emerald: "from-emerald-500/15 to-emerald-500/0 text-emerald-700",
    rose: "from-rose-500/15 to-rose-500/0 text-rose-600",
    indigo: "from-indigo-500/15 to-indigo-500/0 text-indigo-700",
    amber: "from-amber-500/15 to-amber-500/0 text-amber-700",
    sky: "from-sky-500/15 to-sky-500/0 text-sky-700",
  };
  return (
    <Card className="h-full overflow-hidden">
      <CardBody
        className={`flex h-full flex-col gap-2 bg-gradient-to-br !p-3.5 ${accentMap[accent]}`}
      >
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
            {label}
          </div>
          <div className="opacity-80">{icon}</div>
        </div>
        <div className="text-lg font-bold tabular-nums text-[var(--color-foreground)]">
          {value}
        </div>
      </CardBody>
    </Card>
  );
}

function DualValueTile({
  label,
  icon,
  accent,
  values,
}: {
  label?: string;
  icon?: React.ReactNode;
  accent: "emerald" | "rose" | "indigo" | "amber" | "sky";
  values: { label: string; value: string; tone?: "emerald" | "rose" }[];
}) {
  const accentMap: Record<typeof accent, string> = {
    emerald: "from-emerald-500/15 to-emerald-500/0 text-emerald-700",
    rose: "from-rose-500/15 to-rose-500/0 text-rose-600",
    indigo: "from-indigo-500/15 to-indigo-500/0 text-indigo-700",
    amber: "from-amber-500/15 to-amber-500/0 text-amber-700",
    sky: "from-sky-500/15 to-sky-500/0 text-sky-700",
  };
  const toneClass = (tone?: "emerald" | "rose") =>
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "rose"
        ? "text-rose-600"
        : "text-[var(--color-foreground)]";
  return (
    <Card className="h-full overflow-hidden">
      <CardBody
        className={`flex h-full flex-col gap-2 bg-gradient-to-br !p-3.5 ${accentMap[accent]}`}
      >
        {(label || icon) && (
          <div className="flex items-center justify-between">
            {label && (
              <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
                {label}
              </div>
            )}
            {icon && <div className="opacity-80">{icon}</div>}
          </div>
        )}
        <div className="flex items-end gap-3">
          {values.map((v, i) => (
            <Fragment key={i}>
              {i > 0 && (
                <span className="h-8 w-px self-center bg-current opacity-15" />
              )}
              <div className="flex-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                  {v.label}
                </div>
                <div
                  className={`text-lg font-bold tabular-nums ${toneClass(v.tone)}`}
                >
                  {v.value}
                </div>
              </div>
            </Fragment>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
