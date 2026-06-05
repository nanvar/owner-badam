import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Clock, Wallet, ArrowDownLeft, Calendar } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  HeroGradient,
  SoftCard,
  SectionTitle,
} from "@/components/owner/v2/primitives";
import { EmptyState } from "@/components/owner/empty-state";

export default async function OwnerPaymentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const session = await requireRole("OWNER");
  const loc = locale as Locale;
  const t = await getTranslations({ locale, namespace: "owner" });

  const today = new Date();
  const [pendingReservations, pendingExtensions, payments] = await Promise.all([
    prisma.reservation.aggregate({
      where: {
        property: { ownerId: session.userId },
        checkIn: { gt: today },
      },
      _count: { _all: true },
      _sum: { payout: true },
    }),
    prisma.reservationExtension.aggregate({
      where: {
        reservation: { property: { ownerId: session.userId } },
        checkIn: { gt: today },
      },
      _count: { _all: true },
      _sum: { payout: true },
    }),
    prisma.ownerPayment.findMany({
      where: { ownerId: session.userId },
      orderBy: { date: "desc" },
    }),
  ]);
  const upcomingCount =
    pendingReservations._count._all + pendingExtensions._count._all;
  const upcomingPayout =
    (pendingReservations._sum.payout ?? 0) +
    (pendingExtensions._sum.payout ?? 0);
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-4">
      {/* Brand-toned hero — payments page leans on the green/teal
          palette since the numbers are inherently "money in". */}
      <HeroGradient tone="brand">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/85">
          {t("paymentsTotalLabel")}
        </div>
        <div className="mt-1 text-3xl font-bold tabular-nums sm:text-4xl">
          {formatCurrency(totalPaid, "AED", loc)}
        </div>
        <div className="mt-1 text-xs text-white/80">
          Lifetime payouts received from management.
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/15 px-3 py-2.5 backdrop-blur">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/25">
            <Clock className="h-4 w-4 text-white" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-white">
              {upcomingCount} pending {upcomingCount === 1 ? "booking" : "bookings"}
            </div>
            <div className="text-[11px] text-white/75">
              {formatCurrency(upcomingPayout, "AED", loc)} on the way
            </div>
          </div>
        </div>
      </HeroGradient>

      <div>
        <SectionTitle>{t("paymentsReceived")}</SectionTitle>
        {payments.length === 0 ? (
          <EmptyState
            title="No payments yet"
            description="Once management records a payout to you, it will land here with the date, method and reference."
            illustration="/illustrations/owner-payments-empty.svg"
            icon={<Wallet className="h-7 w-7" />}
          />
        ) : (
          <ul className="space-y-2">
            {payments.map((p) => (
              <SoftCard key={p.id} as="li" className="!p-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-700">
                    <ArrowDownLeft className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold tabular-nums text-emerald-700">
                        {formatCurrency(p.amount, "AED", loc)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-muted)]">
                        <Calendar className="h-3 w-3" />
                        {formatDate(p.date.toISOString(), loc)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-muted)]">
                      {p.method && <span>{p.method}</span>}
                      {p.reference && (
                        <span className="truncate">· {p.reference}</span>
                      )}
                    </div>
                  </div>
                </div>
              </SoftCard>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
