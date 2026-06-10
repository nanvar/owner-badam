import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/app-shell";
import { formatCurrency, formatDate, extractBookingRef } from "@/lib/utils";
import { ReportPdfButton, type ReportPdfData } from "@/components/report-pdf-button";

async function fetchLogoAsDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get("content-type") || "image/png";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function OwnerReportDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const session = await requireRole("OWNER");
  const loc = locale as Locale;

  const [report, settings, ownerProfile] = await Promise.all([
    prisma.ownerReport.findUnique({
      where: { id },
      include: {
        property: { select: { name: true, color: true } },
        reservations: { orderBy: { checkIn: "asc" } },
        extensions: {
          include: {
            reservation: {
              select: {
                externalId: true,
                guestName: true,
                rawDescription: true,
              },
            },
          },
          orderBy: { checkIn: "asc" },
        },
        expenses: { orderBy: { date: "asc" } },
      },
    }),
    getSettings(),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        name: true,
        email: true,
        phone: true,
        taxId: true,
        address: true,
      },
    }),
  ]);
  // Owners can only see their own reports.
  if (!report || report.ownerId !== session.userId) notFound();

  // Mirror the admin-side fix: compute totals from current items so the
  // Income / Expenses / Net cards, the Reservations totals row and the
  // PDF all agree on the same numbers. Unpaid items are excluded — the
  // owner shouldn't see settlement money for guest payments that
  // haven't arrived.
  const paidReservations = report.reservations.filter((r) => r.paid);
  const paidExtensions = report.extensions.filter((e) => e.paid);
  const liveIncome =
    paidReservations.reduce((s, r) => s + r.payout, 0) +
    paidExtensions.reduce((s, e) => s + e.payout, 0);
  const liveExpenses = report.expenses.reduce((s, e) => s + e.amount, 0);
  const liveNet = liveIncome - liveExpenses;

  const pdfData: ReportPdfData = {
    name: report.name,
    notes: report.notes,
    createdAt: report.createdAt.toISOString(),
    property: { name: report.property.name },
    owner: {
      name: ownerProfile?.name ?? ownerProfile?.email ?? "",
      email: ownerProfile?.email ?? "",
      phone: ownerProfile?.phone ?? null,
      taxId: ownerProfile?.taxId ?? null,
      address: ownerProfile?.address ?? null,
    },
    reservations: paidReservations.map((r) => ({
      id: r.id,
      bookingRef: extractBookingRef(r.rawDescription),
      checkIn: r.checkIn.toISOString(),
      checkOut: r.checkOut.toISOString(),
      nights: r.nights,
      guestName: r.guestName,
      totalPrice: r.totalPrice,
      agencyCommission: r.agencyCommission,
      portalCommission: r.portalCommission,
      payout: r.payout,
      currency: r.currency,
    })),
    extensions: paidExtensions.map((e) => ({
      id: e.id,
      bookingRef: extractBookingRef(e.reservation.rawDescription),
      parentGuestName: e.reservation.guestName,
      checkIn: e.checkIn.toISOString(),
      checkOut: e.checkOut.toISOString(),
      nights: e.nights,
      totalPrice: e.totalPrice,
      agencyCommission: e.agencyCommission,
      portalCommission: e.portalCommission,
      payout: e.payout,
      currency: e.currency,
    })),
    expenses: report.expenses.map((e) => ({
      id: e.id,
      date: e.date.toISOString(),
      type: e.type,
      description: e.description,
      amount: e.amount,
    })),
    totals: {
      income: liveIncome,
      expenses: liveExpenses,
      net: liveNet,
    },
    brand: {
      name: settings.brandName,
      legalName: settings.legalName,
      logoDataUrl: await fetchLogoAsDataUrl(settings.logoUrl),
      address: [settings.address, settings.city, settings.country]
        .filter(Boolean)
        .join(", ") || null,
      email: settings.email,
      phone: settings.phone,
      website: settings.website,
    },
  };

  return (
    <div>
      <Link
        href={`/${loc}/owner/reports`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Reports
      </Link>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
              <FileText className="h-5 w-5" />
            </span>
            {report.name}
          </span>
        }
        subtitle={
          <span className="text-sm text-[var(--color-muted)]">
            {report.property.name} ·{" "}
            {formatDate(report.createdAt.toISOString(), loc)}
          </span>
        }
        right={<ReportPdfButton data={pdfData} locale={loc} />}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryTile
          label="Income"
          value={formatCurrency(liveIncome, "AED", loc)}
          accent="emerald"
        />
        <SummaryTile
          label="Expenses"
          value={formatCurrency(liveExpenses, "AED", loc)}
          accent="rose"
        />
        <SummaryTile
          label="Net payout"
          value={formatCurrency(liveNet, "AED", loc)}
          accent={liveNet >= 0 ? "brand" : "rose"}
        />
      </div>

      {report.notes && (
        <Card className="mt-4">
          <CardBody className="text-sm whitespace-pre-line text-[var(--color-foreground)]/85">
            {report.notes}
          </CardBody>
        </Card>
      )}

      {(() => {
        type BookingRow = {
          key: string;
          kind: "reservation" | "extension";
          guestName: string | null;
          bookingRef: string | null;
          checkIn: string;
          checkOut: string;
          totalPrice: number;
          agencyCommission: number;
          portalCommission: number;
          payout: number;
          currency: string;
        };
        const bookings: BookingRow[] = [
          ...paidReservations.map((r) => ({
            key: `r-${r.id}`,
            kind: "reservation" as const,
            guestName: r.guestName,
            bookingRef: extractBookingRef(r.rawDescription),
            checkIn: r.checkIn.toISOString(),
            checkOut: r.checkOut.toISOString(),
            totalPrice: r.totalPrice,
            agencyCommission: r.agencyCommission,
            portalCommission: r.portalCommission,
            payout: r.payout,
            currency: r.currency,
          })),
          ...paidExtensions.map((e) => ({
            key: `e-${e.id}`,
            kind: "extension" as const,
            guestName: e.reservation.guestName,
            bookingRef: extractBookingRef(e.reservation.rawDescription),
            checkIn: e.checkIn.toISOString(),
            checkOut: e.checkOut.toISOString(),
            totalPrice: e.totalPrice,
            agencyCommission: e.agencyCommission,
            portalCommission: e.portalCommission,
            payout: e.payout,
            currency: e.currency,
          })),
        ].sort((a, b) => a.checkIn.localeCompare(b.checkIn));
        const totalAgency = bookings.reduce(
          (s, b) => s + b.agencyCommission,
          0,
        );
        const totalPortal = bookings.reduce(
          (s, b) => s + b.portalCommission,
          0,
        );
        const totalRent = bookings.reduce((s, b) => s + b.totalPrice, 0);
        const totalPayout = bookings.reduce((s, b) => s + b.payout, 0);
        return (
          <>
            <h2 className="mt-8 mb-3 text-base font-bold tracking-tight">
              Reservations ({bookings.length})
            </h2>
            {bookings.length === 0 ? (
              <Card>
                <CardBody className="py-8 text-center text-sm text-[var(--color-muted)]">
                  No reservations.
                </CardBody>
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-[var(--color-surface-2)] text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">Guest</th>
                        <th className="px-3 py-2 text-left font-semibold">Ref</th>
                        <th className="px-3 py-2 text-left font-semibold">Dates</th>
                        <th className="px-3 py-2 text-right font-semibold">Total rent</th>
                        <th className="px-3 py-2 text-right font-semibold">Agency</th>
                        <th className="px-3 py-2 text-right font-semibold">Portal</th>
                        <th className="px-3 py-2 text-right font-semibold">Owner payout</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((b) => (
                        <tr
                          key={b.key}
                          className="border-t border-[var(--color-border)]"
                        >
                          <td className="px-3 py-2">
                            <span className="block">{b.guestName ?? "—"}</span>
                            {b.kind === "extension" && (
                              <span className="mt-0.5 inline-flex items-center rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-700">
                                Extension
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-mono text-[10px] text-[var(--color-muted)]">
                            {b.bookingRef ?? "—"}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-[var(--color-muted)]">
                            {formatDate(b.checkIn, loc)} →{" "}
                            {formatDate(b.checkOut, loc)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatCurrency(b.totalPrice, b.currency, loc)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-[var(--color-muted)]">
                            {formatCurrency(b.agencyCommission, b.currency, loc)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-[var(--color-muted)]">
                            {formatCurrency(b.portalCommission, b.currency, loc)}
                          </td>
                          <td className="px-3 py-2 text-right font-bold tabular-nums">
                            {formatCurrency(b.payout, b.currency, loc)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-[var(--color-surface-2)]/60">
                      <tr className="border-t border-[var(--color-border)]">
                        <td
                          colSpan={3}
                          className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider"
                        >
                          Totals
                        </td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums">
                          {formatCurrency(totalRent, "AED", loc)}
                        </td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums">
                          {formatCurrency(totalAgency, "AED", loc)}
                        </td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums">
                          {formatCurrency(totalPortal, "AED", loc)}
                        </td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums">
                          {formatCurrency(totalPayout, "AED", loc)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>
            )}
          </>
        );
      })()}

      <h2 className="mt-8 mb-3 text-base font-bold tracking-tight">
        Expenses ({report.expenses.length})
      </h2>
      {report.expenses.length === 0 ? (
        <Card>
          <CardBody className="py-8 text-center text-sm text-[var(--color-muted)]">
            No expenses.
          </CardBody>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface-2)] text-xs uppercase tracking-wider text-[var(--color-muted)]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Type</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Description
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {report.expenses.map((e) => (
                  <tr
                    key={e.id}
                    className="border-t border-[var(--color-border)]"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDate(e.date.toISOString(), loc)}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">
                      {e.type}
                    </td>
                    <td className="px-4 py-3">{e.description}</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-rose-600">
                      {formatCurrency(e.amount, "AED", loc)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "emerald" | "rose" | "brand";
}) {
  const map: Record<typeof accent, string> = {
    emerald: "from-emerald-500/15 to-emerald-500/0 text-emerald-700",
    rose: "from-rose-500/15 to-rose-500/0 text-rose-600",
    brand:
      "from-[var(--color-brand-soft)] to-transparent text-[var(--color-brand)]",
  };
  return (
    <Card className="overflow-hidden">
      <CardBody className={`bg-gradient-to-br ${map[accent]}`}>
        <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
          {label}
        </div>
        <div className="mt-1.5 text-xl font-bold tabular-nums text-[var(--color-foreground)]">
          {value}
        </div>
      </CardBody>
    </Card>
  );
}
