import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CalendarCheck,
  MapPin,
  FileText,
  Moon,
  Coins,
} from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";
import { ReservationsTabs } from "./reservations-tabs";

export default async function ApartmentDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const session = await requireRole("OWNER");

  const property = await prisma.property.findFirst({
    where: { id, ownerId: session.userId },
    include: {
      reservations: {
        orderBy: { checkIn: "asc" },
      },
    },
  });
  if (!property) notFound();

  const tCommon = await getTranslations({ locale, namespace: "common" });
  const tOwner = await getTranslations({ locale, namespace: "owner" });
  const loc = locale as Locale;
  const today = new Date();

  const totalRevenue = property.reservations.reduce((s, r) => s + r.totalPrice, 0);
  const totalNights = property.reservations.reduce((s, r) => s + r.nights, 0);
  const totalBookings = property.reservations.length;
  const adr = totalNights > 0 ? totalRevenue / totalNights : 0;

  const upcoming = property.reservations
    .filter((r) => r.checkOut >= today)
    .map((r) => ({
      id: r.id,
      guestName: r.guestName,
      checkIn: r.checkIn.toISOString(),
      checkOut: r.checkOut.toISOString(),
      nights: r.nights,
      pricePerNight: r.pricePerNight,
      totalPrice: r.totalPrice,
      currency: r.currency,
    }));
  const past = property.reservations
    .filter((r) => r.checkOut < today)
    .reverse()
    .map((r) => ({
      id: r.id,
      guestName: r.guestName,
      checkIn: r.checkIn.toISOString(),
      checkOut: r.checkOut.toISOString(),
      nights: r.nights,
      pricePerNight: r.pricePerNight,
      totalPrice: r.totalPrice,
      currency: r.currency,
    }));

  return (
    <div className="space-y-4">
      {/* Back link */}
      <Link
        href={`/${locale}/owner/apartments`}
        className="inline-flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
      >
        <ArrowLeft className="h-4 w-4" />
        {tOwner("myProperties")}
      </Link>

      {/* COMPACT HEADER — name+address inline with icon, Reports button on right */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white"
            style={{ background: property.color }}
          >
            <Building2 className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold tracking-tight md:text-xl">
              {property.name}
            </h1>
            {property.address && (
              <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-[var(--color-muted)]">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{property.address}</span>
              </div>
            )}
          </div>
        </div>
        <Link
          href={`/${locale}/owner/reports?propertyId=${property.id}`}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[var(--color-brand)] px-3 text-sm font-medium text-white shadow-sm shadow-emerald-700/25 hover:bg-[var(--color-brand-hover)]"
        >
          <FileText className="h-4 w-4" />
          <span className="hidden sm:inline">{tCommon("reports")}</span>
        </Link>
      </div>

      {/* HERO STATS — single brand-gradient card */}
      <div
        className="relative overflow-hidden rounded-3xl border border-[var(--color-border)] p-5 text-white sm:p-6"
        style={{
          background:
            "linear-gradient(135deg, #4f8a6f 0%, #3d6f57 55%, #2f5a47 100%)",
          boxShadow:
            "0 18px 36px -16px rgba(47,90,71,0.45), 0 8px 18px -10px rgba(79,138,111,0.35)",
        }}
      >
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-36 w-36 rounded-full bg-emerald-200/20 blur-2xl" />

        <div className="relative">
          <div className="text-xs font-medium uppercase tracking-wider text-white/80">
            {tOwner("kpiRevenue")}
          </div>
          <div className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
            {formatCurrency(totalRevenue, "AED", loc)}
          </div>
        </div>
        <div className="relative mt-4 grid grid-cols-3 gap-2">
          <HeroStat
            icon={<CalendarCheck className="h-3.5 w-3.5" />}
            label={tOwner("kpiBookings")}
            value={totalBookings}
          />
          <HeroStat
            icon={<Moon className="h-3.5 w-3.5" />}
            label={tOwner("kpiNights")}
            value={totalNights}
          />
          <HeroStat
            icon={<Coins className="h-3.5 w-3.5" />}
            label={tOwner("kpiAdr")}
            value={formatCurrency(adr, "AED", loc)}
          />
        </div>
      </div>

      {/* Reservation tabs (Upcoming | Past) */}
      <ReservationsTabs
        upcoming={upcoming}
        past={past}
        locale={loc}
        labels={{
          upcoming: tOwner("upcoming"),
          past: tCommon("reservations"),
          noUpcoming: tOwner("noUpcoming"),
          noPast: tCommon("noData"),
          guest: tOwner("guest"),
          total: tCommon("total"),
        }}
      />
    </div>
  );
}

function HeroStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white/15 p-3 backdrop-blur-sm">
      <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-white/80">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 text-base font-bold sm:text-lg">{value}</div>
    </div>
  );
}
