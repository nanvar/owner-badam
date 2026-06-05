import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Home, MapPin, BedDouble } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { EmptyState } from "@/components/owner/empty-state";
import { CategoryBadge } from "@/components/owner/v2/primitives";

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
      _count: { select: { events: true, reservations: true } },
    },
  });

  return (
    <div className="space-y-3">
      {/* Page heading — single line so the visual weight stays on
          the cards below, not the header. */}
      <div className="flex items-end justify-between px-1">
        <h1 className="text-2xl font-bold tracking-tight">Your properties</h1>
        <span className="text-xs text-[var(--color-muted)]">
          {properties.length} {properties.length === 1 ? "home" : "homes"}
        </span>
      </div>

      {properties.length === 0 ? (
        <EmptyState
          title="No properties on file"
          description="Properties show here once management adds them to your account."
          illustration="/illustrations/owner-properties-empty.svg"
          icon={<Home className="h-7 w-7" />}
        />
      ) : (
        <div className="space-y-3">
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
                className="group block overflow-hidden rounded-[24px] border border-[var(--color-border)] bg-white transition-shadow hover:shadow-md active:scale-[.99]"
              >
                <div className="relative">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cover}
                      alt={p.name}
                      className="h-44 w-full object-cover sm:h-56"
                    />
                  ) : (
                    <div
                      className="grid h-44 w-full place-items-center text-white sm:h-56"
                      style={{ background: p.color }}
                    >
                      <Home className="h-10 w-10 opacity-80" />
                    </div>
                  )}
                  <div className="absolute left-3 top-3">
                    {p.managementOnly ? (
                      <CategoryBadge tone="indigo">Management only</CategoryBadge>
                    ) : (
                      <CategoryBadge tone="warm">Rental</CategoryBadge>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5 p-4">
                  <div className="text-base font-bold leading-tight tracking-tight">
                    {p.name}
                  </div>
                  {p.address && (
                    <div className="flex items-center gap-1 text-xs text-[var(--color-muted)]">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{p.address}</span>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-[var(--color-muted)]">
                    {p.bedrooms !== null && (
                      <span className="inline-flex items-center gap-1">
                        <BedDouble className="h-3 w-3" />
                        {p.bedrooms} bed{p.bedrooms === 1 ? "" : "s"}
                      </span>
                    )}
                    {p._count.events > 0 && (
                      <span>· {p._count.events} log{p._count.events === 1 ? "" : "s"}</span>
                    )}
                    {p._count.reservations > 0 && (
                      <span>· {p._count.reservations} bookings</span>
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
