import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, CalendarCheck, Coins, User, Mail } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { Card, CardBody, CardHeader, CardTitle, StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app-shell";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function OwnerDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const owner = await prisma.user.findUnique({
    where: { id },
    include: {
      properties: {
        include: {
          _count: { select: { reservations: true } },
          reservations: {
            select: { totalPrice: true, nights: true, checkIn: true, checkOut: true, currency: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!owner || owner.role !== "OWNER") notFound();

  const tCommon = await getTranslations({ locale, namespace: "common" });
  const tAdmin = await getTranslations({ locale, namespace: "admin" });
  const tOwner = await getTranslations({ locale, namespace: "owner" });

  const totalReservations = owner.properties.reduce((s, p) => s + p._count.reservations, 0);
  const totalRevenue = owner.properties
    .flatMap((p) => p.reservations)
    .reduce((s, r) => s + r.totalPrice, 0);
  const totalNights = owner.properties
    .flatMap((p) => p.reservations)
    .reduce((s, r) => s + r.nights, 0);

  const loc = locale as Locale;

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
          label={tOwner("kpiRevenue")}
          value={formatCurrency(totalRevenue, "AED", loc)}
          icon={<Coins className="h-4 w-4" />}
          accent="amber"
        />
      </div>

      <Card className="mt-6 overflow-hidden">
        <CardHeader>
          <CardTitle>
            <Building2 className="-mt-0.5 mr-1 inline h-4 w-4" />
            {tCommon("properties")}
          </CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {owner.properties.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-[var(--color-muted)]">
              {tAdmin("noProperties")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-surface-2)] text-xs uppercase tracking-wider text-[var(--color-muted)]">
                  <tr>
                    <th className="px-5 py-3 text-left font-semibold">{tAdmin("name")}</th>
                    <th className="px-4 py-3 text-left font-semibold">iCal</th>
                    <th className="px-4 py-3 text-right font-semibold">{tAdmin("basePrice")}</th>
                    <th className="px-4 py-3 text-right font-semibold">{tAdmin("cleaningFee")}</th>
                    <th className="px-4 py-3 text-right font-semibold">{tCommon("reservations")}</th>
                    <th className="px-4 py-3 text-left font-semibold">{tCommon("lastSynced")}</th>
                  </tr>
                </thead>
                <tbody>
                  {owner.properties.map((p) => (
                    <tr key={p.id} className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]/60">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="h-8 w-1 shrink-0 rounded-full"
                            style={{ background: p.color }}
                          />
                          <div className="min-w-0">
                            <div className="truncate font-semibold">{p.name}</div>
                            {p.address && (
                              <div className="truncate text-xs text-[var(--color-muted)]">
                                {p.address}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {p.airbnbIcalUrl ? (
                          <Badge tone="success">set</Badge>
                        ) : (
                          <Badge tone="warning">missing</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatCurrency(p.basePrice, "AED", loc)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatCurrency(p.cleaningFee, "AED", loc)}
                      </td>
                      <td className="px-4 py-3 text-right">{p._count.reservations}</td>
                      <td className="px-4 py-3 text-xs text-[var(--color-muted)] whitespace-nowrap">
                        {p.lastSyncedAt ? formatDate(p.lastSyncedAt, loc) : tCommon("never")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
