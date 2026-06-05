import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Home, ChevronRight } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/owner/empty-state";

export default async function OwnerPropertiesListPage({
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
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      address: true,
      color: true,
      managementOnly: true,
      coverPhotoUrl: true,
      photos: true,
      bedrooms: true,
      bathrooms: true,
      _count: {
        select: { events: true, reservations: true },
      },
    },
  });

  return (
    <div className="space-y-3">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Home className="h-5 w-5 text-[var(--color-brand)]" />
            Your properties
          </span>
        }
      />

      {properties.length === 0 ? (
        <EmptyState
          title="No properties on file"
          description="Properties show here once management adds them to your account."
          illustration="/illustrations/owner-properties-empty.svg"
          icon={<Home className="h-7 w-7" />}
        />
      ) : (
        <div className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2">
          {properties.map((p) => {
            const photosArr =
              (p.photos as { url: string }[] | null) ?? [];
            const cover =
              p.coverPhotoUrl ||
              (photosArr.length > 0 ? photosArr[0].url : null);
            return (
              <Link
                key={p.id}
                href={`/${locale}/owner/properties/${p.id}`}
                className="group flex overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white transition-shadow hover:shadow-lg"
              >
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cover}
                    alt={p.name}
                    className="h-28 w-28 shrink-0 object-cover sm:h-32 sm:w-32"
                  />
                ) : (
                  <div
                    className="grid h-28 w-28 shrink-0 place-items-center text-white sm:h-32 sm:w-32"
                    style={{ background: p.color }}
                  >
                    <Home className="h-8 w-8" />
                  </div>
                )}
                <div className="flex min-w-0 flex-1 flex-col justify-between p-3">
                  <div>
                    <div className="flex items-center gap-1 truncate text-sm font-semibold tracking-tight group-hover:text-[var(--color-brand)]">
                      {p.name}
                      <ChevronRight className="h-3.5 w-3.5 text-[var(--color-muted)] transition-transform group-hover:translate-x-0.5" />
                    </div>
                    {p.address && (
                      <div className="mt-0.5 truncate text-xs text-[var(--color-muted)]">
                        {p.address}
                      </div>
                    )}
                    {p.managementOnly && (
                      <span className="mt-1 inline-flex rounded-full bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                        Management only
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--color-muted)]">
                    {p._count.events > 0 && (
                      <span className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5">
                        {p._count.events} log
                        {p._count.events === 1 ? "" : "s"}
                      </span>
                    )}
                    {p._count.reservations > 0 && (
                      <span className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5">
                        {p._count.reservations} bookings
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
