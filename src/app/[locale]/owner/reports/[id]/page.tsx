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
import { formatCurrency, formatDate } from "@/lib/utils";
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
    reservations: report.reservations.map((r) => ({
      id: r.id,
      checkIn: r.checkIn.toISOString(),
      checkOut: r.checkOut.toISOString(),
      nights: r.nights,
      guestName: r.guestName,
      totalPrice: r.totalPrice,
      payout: r.payout,
      currency: r.currency,
    })),
    expenses: report.expenses.map((e) => ({
      id: e.id,
      date: e.date.toISOString(),
      type: e.type,
      description: e.description,
      amount: e.amount,
    })),
    totals: {
      income: report.totalIncome,
      expenses: report.totalExpenses,
      net: report.netPayout,
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
          value={formatCurrency(report.totalIncome, "AED", loc)}
          accent="emerald"
        />
        <SummaryTile
          label="Expenses"
          value={formatCurrency(report.totalExpenses, "AED", loc)}
          accent="rose"
        />
        <SummaryTile
          label="Net payout"
          value={formatCurrency(report.netPayout, "AED", loc)}
          accent="brand"
        />
      </div>

      {report.notes && (
        <Card className="mt-4">
          <CardBody className="text-sm whitespace-pre-line text-[var(--color-foreground)]/85">
            {report.notes}
          </CardBody>
        </Card>
      )}

      <h2 className="mt-8 mb-3 text-base font-bold tracking-tight">
        Reservations ({report.reservations.length})
      </h2>
      {report.reservations.length === 0 ? (
        <Card>
          <CardBody className="py-8 text-center text-sm text-[var(--color-muted)]">
            No reservations.
          </CardBody>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface-2)] text-xs uppercase tracking-wider text-[var(--color-muted)]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Guest</th>
                  <th className="px-4 py-3 text-left font-semibold">Stay</th>
                  <th className="px-4 py-3 text-right font-semibold">Nights</th>
                  <th className="px-4 py-3 text-right font-semibold">Payout</th>
                </tr>
              </thead>
              <tbody>
                {report.reservations.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-[var(--color-border)]"
                  >
                    <td className="px-4 py-3">{r.guestName ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-[var(--color-muted)]">
                      {formatDate(r.checkIn.toISOString(), loc)} →{" "}
                      {formatDate(r.checkOut.toISOString(), loc)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.nights}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">
                      {formatCurrency(r.payout, r.currency, loc)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

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
