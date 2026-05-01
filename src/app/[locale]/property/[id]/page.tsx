import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BedDouble,
  Bath,
  Bed,
  Users,
  MapPin,
  CheckCircle2,
  Sparkles,
  CalendarCheck,
} from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PublicShell } from "@/components/public/public-shell";
import { PropertyGallery } from "@/components/public/property-gallery";

export default async function PublicPropertyPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;

  const [session, settings, property] = await Promise.all([
    readSession(),
    getSettings(),
    prisma.property.findUnique({
      where: { id },
      include: {
        owner: { select: { blocked: true } },
      },
    }),
  ]);
  if (!property || property.owner.blocked || !property.airbnbUrl) notFound();

  const photos = (property.photos as { url: string }[] | null) ?? [];
  const amenities = (property.amenities as string[] | null) ?? [];

  const stats = [
    {
      icon: <BedDouble className="h-5 w-5" />,
      label: "Bedrooms",
      value: property.bedrooms,
    },
    {
      icon: <Bed className="h-5 w-5" />,
      label: "Beds",
      value: property.beds,
    },
    {
      icon: <Bath className="h-5 w-5" />,
      label: "Bathrooms",
      value: property.bathrooms,
    },
    {
      icon: <Users className="h-5 w-5" />,
      label: "Guests",
      value: property.maxGuests,
    },
  ].filter((s) => s.value != null);

  const sessionInfo = session
    ? {
        signedIn: true,
        role: session.role as "ADMIN" | "OWNER" | "SUPERADMIN",
        name: session.name,
      }
    : null;

  const inquiryHref = `mailto:${
    settings.email ?? "info@badam.ae"
  }?subject=${encodeURIComponent(`Booking inquiry — ${property.name}`)}`;

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
      <div className="mx-auto max-w-6xl px-4 py-6">
        <Link
          href={`/${loc}`}
          className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to all properties
        </Link>

        <div className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {property.name}
          </h1>
          {property.address && (
            <div className="mt-1 flex items-center gap-1.5 text-sm text-[var(--color-muted)]">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span>{property.address}</span>
            </div>
          )}
        </div>

        {photos.length > 0 ? (
          <PropertyGallery photos={photos} name={property.name} />
        ) : (
          <div className="mb-6 grid place-items-center gap-3 rounded-3xl border border-dashed border-[var(--color-border)] bg-white px-6 py-20 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
              <Sparkles className="h-7 w-7" />
            </div>
            <p className="text-sm text-[var(--color-muted)]">
              Photos coming soon.
            </p>
          </div>
        )}

        {stats.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-3 rounded-2xl border border-[var(--color-border)] bg-white p-4">
            {stats.map((s, i) => (
              <div
                key={s.label}
                className={`flex items-center gap-3 px-3 ${
                  i > 0 ? "border-l border-[var(--color-border)]" : ""
                }`}
              >
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
                  {s.icon}
                </div>
                <div>
                  <div className="text-xl font-bold tabular-nums leading-none">
                    {s.value}
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-wider text-[var(--color-muted)]">
                    {s.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="space-y-8">
            {property.description && (
              <section>
                <h2 className="mb-3 text-lg font-bold tracking-tight">
                  About this place
                </h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--color-foreground)]/85">
                  {property.description}
                </p>
              </section>
            )}

            {amenities.length > 0 && (
              <section>
                <h2 className="mb-3 flex items-center gap-2 text-lg font-bold tracking-tight">
                  <Sparkles className="h-5 w-5 text-[var(--color-brand)]" />
                  What this place offers
                </h2>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                  {amenities.map((a) => (
                    <div
                      key={a}
                      className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[var(--color-brand)]" />
                      <span className="truncate">{a}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-lg shadow-emerald-900/10">
              <h3 className="mb-3 text-sm font-bold tracking-tight">
                Interested in this stay?
              </h3>
              <p className="mb-4 text-xs leading-relaxed text-[var(--color-muted)]">
                Send us your dates and we'll confirm availability + pricing
                within a few hours.
              </p>
              <a
                href={inquiryHref}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--color-brand)] text-sm font-bold text-white shadow shadow-emerald-700/25 transition-transform hover:scale-[1.02]"
              >
                <CalendarCheck className="h-4 w-4" />
                Request to book
              </a>
              {settings.whatsapp && (
                <a
                  href={`https://wa.me/${settings.whatsapp.replace(
                    /[^0-9]/g,
                    "",
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-2xl border-2 border-[var(--color-border)] text-sm font-semibold transition-colors hover:border-emerald-500 hover:text-emerald-600"
                >
                  WhatsApp us
                </a>
              )}
            </div>
          </aside>
        </div>
      </div>
    </PublicShell>
  );
}
