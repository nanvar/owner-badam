import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Building2, ChevronRight, MapPin } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app-shell";
import { formatCurrency } from "@/lib/utils";

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
    include: { _count: { select: { reservations: true } } },
    orderBy: { createdAt: "asc" },
  });

  const tOwner = await getTranslations({ locale, namespace: "owner" });
  const loc = locale as Locale;

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
          {properties.map((p) => (
            <Link
              key={p.id}
              href={`/${locale}/owner/apartments/${p.id}`}
              className="group block"
            >
              <Card className="flex h-full items-stretch overflow-hidden transition-shadow hover:shadow-md">
                <span
                  className="w-1.5 shrink-0"
                  style={{ background: p.color }}
                />
                <div className="flex flex-1 items-center gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-bold tracking-tight">
                      {p.name}
                    </div>
                    {p.address && (
                      <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-[var(--color-muted)]">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{p.address}</span>
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--color-muted)]">
                      {p.basePrice > 0 ? (
                        <span className="font-semibold text-[var(--color-foreground)]">
                          {formatCurrency(p.basePrice, "AED", loc)}
                          <span className="font-normal text-[var(--color-muted)]">
                            {" "}/ night
                          </span>
                        </span>
                      ) : (
                        <span>—</span>
                      )}
                      <span className="text-[var(--color-border)]">·</span>
                      <span>{p._count.reservations} bookings</span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-brand)]" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
