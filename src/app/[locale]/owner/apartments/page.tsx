import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Building2, ChevronRight, MapPin } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app-shell";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function OwnerApartmentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const session = await requireRole("OWNER");

  const properties = await prisma.property.findMany({
    where: { ownerId: session.userId },
    include: {
      _count: { select: { reservations: true } },
      reservations: {
        select: { totalPrice: true, nights: true, checkIn: true, checkOut: true, currency: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const tCommon = await getTranslations({ locale, namespace: "common" });
  const tOwner = await getTranslations({ locale, namespace: "owner" });
  const tAdmin = await getTranslations({ locale, namespace: "admin" });
  const loc = locale as Locale;
  const today = new Date();

  return (
    <div>
      <PageHeader title={tOwner("myProperties")} />

      {properties.length === 0 ? (
        <Card className="grid place-items-center gap-3 px-6 py-14 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
            <Building2 className="h-7 w-7" />
          </div>
          <p className="text-sm text-[var(--color-muted)]">{tOwner("noProperties")}</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => {
            const totalRevenue = p.reservations.reduce((s, r) => s + r.totalPrice, 0);
            const totalNights = p.reservations.reduce((s, r) => s + r.nights, 0);
            const upcoming = p.reservations.filter((r) => new Date(r.checkIn) >= today).length;
            return (
              <Link
                key={p.id}
                href={`/${locale}/owner/apartments/${p.id}`}
                className="group block"
              >
                <Card className="h-full transition-shadow group-hover:shadow-md">
                  <div
                    className="flex h-1.5 rounded-t-2xl"
                    style={{ background: p.color }}
                  />
                  <CardBody className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-base font-bold">{p.name}</h3>
                        {p.address && (
                          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-[var(--color-muted)]">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {p.address}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-brand)]" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <Stat
                        label={tOwner("basePrice")}
                        value={formatCurrency(p.basePrice, "AED", loc)}
                      />
                      <Stat
                        label={tOwner("kpiNights")}
                        value={totalNights}
                      />
                      <Stat
                        label={tCommon("reservations")}
                        value={`${p._count.reservations} (${upcoming} upcoming)`}
                      />
                      <Stat
                        label={tOwner("kpiRevenue")}
                        value={formatCurrency(totalRevenue, "AED", loc)}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {p.airbnbIcalUrl ? (
                        <Badge tone="success">iCal connected</Badge>
                      ) : (
                        <Badge tone="warning">No iCal</Badge>
                      )}
                      <Badge tone="neutral">
                        {tCommon("lastSynced")}:{" "}
                        {p.lastSyncedAt ? formatDate(p.lastSyncedAt, loc) : tCommon("never")}
                      </Badge>
                    </div>
                  </CardBody>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-[var(--color-surface-2)] p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}
