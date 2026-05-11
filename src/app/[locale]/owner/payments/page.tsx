import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Clock, Wallet } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/app-shell";
import { formatCurrency, formatDate } from "@/lib/utils";

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

  // "Upcoming" payouts are bookings the owner hasn't been settled for
  // yet — i.e. reservations + extensions whose check-in is still in the
  // future. Counted across both since each is treated as an own booking.
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
    <div>
      <PageHeader title={t("paymentsTitle")} />

      <Card className="overflow-hidden">
        <CardBody className="bg-gradient-to-br from-sky-500/15 to-sky-500/0">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-sky-500/15 text-sky-700">
              <Clock className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-sky-700">
                {t("paymentsUpcoming")}
              </div>
              <div className="text-base font-bold tabular-nums">
                {upcomingCount}{" "}
                {upcomingCount === 1
                  ? t("reservationOne")
                  : t("reservationMany")}
                <span className="ml-2 text-sm font-medium text-[var(--color-muted)]">
                  · {t("paymentsExpectedPayout")}{" "}
                  {formatCurrency(upcomingPayout, "AED", loc)}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-[var(--color-muted)]">
                {t("paymentsPending")}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="mt-6">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold tracking-tight">
          <Wallet className="h-4 w-4 text-[var(--color-brand)]" />
          {t("paymentsReceived")}
          <span className="text-xs font-normal text-[var(--color-muted)]">
            · {t("paymentsTotalLabel")} {formatCurrency(totalPaid, "AED", loc)}
          </span>
        </h2>
        {payments.length === 0 ? (
          <Card>
            <CardBody className="py-10 text-center text-sm text-[var(--color-muted)]">
              {t("paymentsEmpty")}
            </CardBody>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-surface-2)] text-xs uppercase tracking-wider text-[var(--color-muted)]">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">
                      {t("date")}
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      {t("amount")}
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      {t("paymentsMethod")}
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      {t("paymentsReference")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr
                      key={p.id}
                      className="border-t border-[var(--color-border)]"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatDate(p.date.toISOString(), loc)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-emerald-700">
                        {formatCurrency(p.amount, "AED", loc)}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">
                        {p.method ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">
                        {p.reference ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
