import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CalendarCheck,
  MapPin,
  FileText,
  User,
  Moon,
  Coins,
} from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app-shell";
import { formatCurrency, formatDate } from "@/lib/utils";

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
  const upcomingReservations = property.reservations.filter(
    (r) => r.checkOut >= today,
  );
  const pastReservations = property.reservations
    .filter((r) => r.checkOut < today)
    .reverse();

  return (
    <div className="space-y-5">
      <Link
        href={`/${locale}/owner/apartments`}
        className="inline-flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
      >
        <ArrowLeft className="h-4 w-4" />
        {tOwner("myProperties")}
      </Link>

      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span
              className="grid h-10 w-10 place-items-center rounded-2xl text-white"
              style={{ background: property.color }}
            >
              <Building2 className="h-5 w-5" />
            </span>
            {property.name}
          </span>
        }
        subtitle={
          property.address && (
            <span className="flex items-center gap-1 text-sm text-[var(--color-muted)]">
              <MapPin className="h-3.5 w-3.5" />
              {property.address}
            </span>
          )
        }
        right={
          <div className="flex items-center gap-2">
            {property.airbnbIcalUrl ? (
              <Badge tone="success">iCal</Badge>
            ) : (
              <Badge tone="warning">No iCal</Badge>
            )}
            <Link
              href={`/${locale}/owner/reports?propertyId=${property.id}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[var(--color-brand)] px-3 text-sm font-medium text-white shadow-sm shadow-emerald-700/25 hover:bg-[var(--color-brand-hover)]"
            >
              <FileText className="h-4 w-4" />
              {tCommon("reports")}
            </Link>
          </div>
        }
      />

      {/* HERO STATS — clean card, not 4 colored boxes */}
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

      {/* Details panel */}
      <Card>
        <CardHeader>
          <CardTitle>{tCommon("details")}</CardTitle>
        </CardHeader>
        <CardBody className="grid gap-3 text-sm sm:grid-cols-3">
          <DetailRow
            label={tOwner("basePrice")}
            value={
              property.basePrice > 0
                ? formatCurrency(property.basePrice, "AED", loc)
                : "—"
            }
          />
          <DetailRow
            label={tOwner("cleaningFee")}
            value={
              property.cleaningFee > 0
                ? formatCurrency(property.cleaningFee, "AED", loc)
                : "—"
            }
          />
          <DetailRow
            label={tCommon("lastSynced")}
            value={
              property.lastSyncedAt
                ? formatDate(property.lastSyncedAt, loc)
                : tCommon("never")
            }
          />
          {property.notes && (
            <div className="sm:col-span-3">
              <div className="text-[11px] uppercase tracking-wider text-[var(--color-muted)]">
                {tCommon("notes")}
              </div>
              <div className="mt-1 whitespace-pre-wrap text-sm">{property.notes}</div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* UPCOMING — cards, not table */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-[var(--color-brand)]" />
          <h2 className="text-base font-bold tracking-tight">
            {tOwner("upcoming")}
          </h2>
          {upcomingReservations.length > 0 && (
            <span className="ml-1 rounded-full bg-[var(--color-brand-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-brand)]">
              {upcomingReservations.length}
            </span>
          )}
        </div>
        {upcomingReservations.length === 0 ? (
          <Card className="grid place-items-center px-6 py-10 text-sm text-[var(--color-muted)]">
            {tOwner("noUpcoming")}
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingReservations.map((r) => (
              <ReservationCard
                key={r.id}
                guestName={r.guestName}
                checkIn={r.checkIn}
                checkOut={r.checkOut}
                nights={r.nights}
                pricePerNight={r.pricePerNight}
                totalPrice={r.totalPrice}
                currency={r.currency}
                locale={loc}
                accent="upcoming"
                guestLabel={tOwner("guest")}
              />
            ))}
          </div>
        )}
      </section>

      {/* PAST — cards too */}
      {pastReservations.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-base font-bold tracking-tight">
              {tCommon("reservations")}
            </h2>
            <span className="ml-1 rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-muted)]">
              {pastReservations.length}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pastReservations.map((r) => (
              <ReservationCard
                key={r.id}
                guestName={r.guestName}
                checkIn={r.checkIn}
                checkOut={r.checkOut}
                nights={r.nights}
                pricePerNight={r.pricePerNight}
                totalPrice={r.totalPrice}
                currency={r.currency}
                locale={loc}
                accent="past"
                guestLabel={tOwner("guest")}
              />
            ))}
          </div>
        </section>
      )}
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

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-[var(--color-surface-2)] p-3">
      <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function ReservationCard({
  guestName,
  checkIn,
  checkOut,
  nights,
  pricePerNight,
  totalPrice,
  currency,
  locale,
  accent,
  guestLabel,
}: {
  guestName: string | null;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  pricePerNight: number;
  totalPrice: number;
  currency: string;
  locale: Locale;
  accent: "upcoming" | "past";
  guestLabel: string;
}) {
  const day = checkIn.getDate();
  const month = checkIn
    .toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US", { month: "short" })
    .toUpperCase();
  const cur = currency || "AED";

  return (
    <div
      className={
        accent === "upcoming"
          ? "rounded-2xl border border-[var(--color-brand-soft)] bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          : "rounded-2xl border border-[var(--color-border)] bg-white p-4 transition-shadow hover:shadow-sm"
      }
    >
      <div className="flex items-start gap-3">
        <div
          className={
            accent === "upcoming"
              ? "grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[var(--color-brand-soft)] text-center leading-tight text-[var(--color-brand)]"
              : "grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[var(--color-surface-2)] text-center leading-tight text-[var(--color-muted)]"
          }
        >
          <div>
            <div className="text-base font-bold leading-none">{day}</div>
            <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider">
              {month}
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <User className="h-3.5 w-3.5 shrink-0 text-[var(--color-muted)]" />
            <span className="truncate">{guestName ?? guestLabel}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-[var(--color-muted)]">
            <span>{formatDate(checkIn, locale)}</span>
            <span>→</span>
            <span>{formatDate(checkOut, locale)}</span>
            <span>·</span>
            <span>
              {nights}n
              {pricePerNight > 0 && (
                <>
                  {" · "}
                  {formatCurrency(pricePerNight, cur, locale)}/n
                </>
              )}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border)] pt-3 text-sm">
        <span className="text-[var(--color-muted)]">Total</span>
        <span className="font-bold">{formatCurrency(totalPrice, cur, locale)}</span>
      </div>
    </div>
  );
}
