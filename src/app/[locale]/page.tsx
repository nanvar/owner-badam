import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import {
  BedDouble,
  Bath,
  Users,
  ArrowRight,
  MapPin,
  Sparkles,
} from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PublicShell } from "@/components/public/public-shell";
import { SearchBar } from "@/components/public/search-bar";

export default async function LocaleRootPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ from?: string; to?: string; guests?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const sp = await searchParams;
  const loc = locale as Locale;

  const [session, settings, properties] = await Promise.all([
    readSession(),
    getSettings(),
    prisma.property.findMany({
      // Only properties that are actually listed on Airbnb appear publicly —
      // those without an Airbnb URL haven't been crawled and have no photos
      // / description / capacity, so the listing card would be empty.
      where: { airbnbUrl: { not: null } },
      include: {
        owner: {
          select: { blocked: true },
        },
        // Both Airbnb-synced reservations AND our own direct bookings
        // count as "occupied" when checking availability for the search.
        reservations:
          sp.from && sp.to
            ? {
                where: {
                  checkIn: { lte: new Date(sp.to) },
                  checkOut: { gt: new Date(sp.from) },
                },
                select: { id: true },
                take: 1,
              }
            : undefined,
        directBookings:
          sp.from && sp.to
            ? {
                where: {
                  status: { in: ["PENDING", "PAID"] },
                  checkIn: { lte: new Date(sp.to) },
                  checkOut: { gt: new Date(sp.from) },
                },
                select: { id: true },
                take: 1,
              }
            : undefined,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Don't surface owners that have been blocked.
  const visibleProperties = properties.filter((p) => !p.owner.blocked);

  // Filter by date availability when range is supplied. A property is
  // available if NO reservation AND NO direct booking overlaps the window.
  const filtered =
    sp.from && sp.to
      ? visibleProperties.filter(
          (p) => p.reservations.length === 0 && p.directBookings.length === 0,
        )
      : visibleProperties;

  // Filter by guest capacity if specified.
  const minGuests = sp.guests ? Number(sp.guests) : null;
  const final =
    minGuests && Number.isFinite(minGuests)
      ? filtered.filter((p) => (p.maxGuests ?? 0) >= minGuests)
      : filtered;

  const sessionInfo = session
    ? {
        signedIn: true,
        role: session.role as "ADMIN" | "OWNER" | "SUPERADMIN",
        name: session.name,
      }
    : null;

  return (
    <PublicShell
      locale={loc}
      session={sessionInfo}
      brand={{
        name: settings.brandName,
        legalName: settings.legalName,
        tagline: settings.tagline,
        logoUrl: settings.logoUrl,
        email: settings.email,
        phone: settings.phone,
        whatsapp: settings.whatsapp,
        website: settings.website,
        address: settings.address,
        city: settings.city,
        country: settings.country,
        instagram: settings.instagram,
        facebook: settings.facebook,
        linkedin: settings.linkedin,
        about: settings.about,
      }}
    >
      {/* Hero */}
      <section
        className="relative overflow-hidden border-b border-[var(--color-border)]"
        style={{
          background:
            "linear-gradient(160deg, #f3f7f4 0%, #e8efe9 35%, #ffffff 70%, #ffffff 100%)",
        }}
      >
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full opacity-50 blur-3xl"
          style={{ background: "rgba(168,200,182,0.6)" }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-16 md:py-24">
          <div className="mb-10 text-center">
            <h1 className="mx-auto max-w-3xl text-balance text-3xl font-bold tracking-tight text-[var(--color-foreground)] md:text-5xl">
              Curated short-term rentals across{" "}
              <span className="text-[var(--color-brand)]">
                {settings.city ?? "Dubai"}
              </span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm text-[var(--color-muted)] md:text-base">
              {settings.tagline}
            </p>
          </div>
          <SearchBar locale={loc} />
        </div>
      </section>

      {/* Properties grid */}
      <section id="properties" className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-6 flex items-baseline justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight md:text-2xl">
            Our properties
          </h2>
          <span className="text-xs text-[var(--color-muted)]">
            {final.length} {final.length === 1 ? "home" : "homes"}
            {sp.from && sp.to ? ` available ${sp.from} → ${sp.to}` : ""}
          </span>
        </div>
        {final.length === 0 ? (
          <div className="grid place-items-center gap-3 rounded-3xl border border-dashed border-[var(--color-border)] bg-white px-6 py-16 text-center">
            <Sparkles className="h-8 w-8 text-[var(--color-muted)]" />
            <p className="text-sm text-[var(--color-muted)]">
              No properties match your search. Try different dates.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {final.map((p) => {
              const photos =
                (p.photos as { url: string }[] | null) ?? [];
              const hero = photos[0];
              return (
                <Link
                  key={p.id}
                  href={`/${loc}/property/${p.id}`}
                  className="group flex flex-col overflow-hidden rounded-3xl border border-[var(--color-border)] bg-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-900/10"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--color-surface-2)]">
                    {hero ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={hero.url}
                        alt={p.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-[var(--color-muted)]">
                        <Sparkles className="h-8 w-8" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="truncate text-base font-bold tracking-tight">
                        {p.name}
                      </h3>
                      <ArrowRight className="h-4 w-4 shrink-0 text-[var(--color-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-brand)]" />
                    </div>
                    {p.address && (
                      <div className="flex items-center gap-1 truncate text-xs text-[var(--color-muted)]">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{p.address}</span>
                      </div>
                    )}
                    <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-foreground)]/80">
                      {p.bedrooms != null && (
                        <span className="inline-flex items-center gap-1">
                          <BedDouble className="h-3.5 w-3.5" />
                          {p.bedrooms} bed
                          {p.bedrooms === 1 ? "" : "s"}
                        </span>
                      )}
                      {p.bathrooms != null && (
                        <span className="inline-flex items-center gap-1">
                          <Bath className="h-3.5 w-3.5" />
                          {p.bathrooms} bath
                          {p.bathrooms === 1 ? "" : "s"}
                        </span>
                      )}
                      {p.maxGuests != null && (
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          up to {p.maxGuests}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* About */}
      {settings.about && (
        <section
          id="about"
          className="border-y border-[var(--color-border)] bg-[var(--color-surface-2)]/40"
        >
          <div className="mx-auto max-w-3xl px-4 py-14 text-center">
            <h2 className="mb-4 text-xl font-bold tracking-tight md:text-2xl">
              About {settings.brandName}
            </h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--color-foreground)]/85 md:text-base">
              {settings.about}
            </p>
          </div>
        </section>
      )}
    </PublicShell>
  );
}
