import { setRequestLocale } from "next-intl/server";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/app-shell";
import { formatCurrency, formatDate } from "@/lib/utils";
import { DeleteReportButton } from "./delete-report-button";
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

export default async function AdminReportDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  await requireRole("ADMIN");
  const loc = locale as Locale;

  const [report, settings] = await Promise.all([
    prisma.ownerReport.findUnique({
      where: { id },
      include: {
        property: { select: { name: true, color: true } },
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            taxId: true,
            address: true,
          },
        },
        createdBy: { select: { name: true, email: true } },
        reservations: { orderBy: { checkIn: "asc" } },
        expenses: { orderBy: { date: "asc" } },
      },
    }),
    getSettings(),
  ]);
  if (!report) notFound();

  const pdfData: ReportPdfData = {
    name: report.name,
    notes: report.notes,
    createdAt: report.createdAt.toISOString(),
    property: { name: report.property.name },
    owner: {
      name: report.owner.name ?? report.owner.email,
      email: report.owner.email,
      phone: report.owner.phone,
      taxId: report.owner.taxId,
      address: report.owner.address,
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
      address:
        [settings.address, settings.city, settings.country]
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
        href={`/${loc}/admin/reports`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to reports
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
            <Link
              href={`/${loc}/admin/owners/${report.owner.id}`}
              className="underline-offset-4 hover:text-[var(--color-brand)] hover:underline"
            >
              {report.owner.name ?? report.owner.email}
            </Link>{" "}
            · {formatDate(report.createdAt.toISOString(), loc)}
            {report.createdBy && (
              <span> · by {report.createdBy.name ?? report.createdBy.email}</span>
            )}
          </span>
        }
        right={
          <div className="flex items-center gap-2">
            <ReportPdfButton data={pdfData} locale={loc} />
            <DeleteReportButton
              id={report.id}
              name={report.name}
              locale={loc}
            />
          </div>
        }
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
            No reservations in this report.
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
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
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
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCurrency(r.totalPrice, r.currency, loc)}
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
            No expenses in this report.
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
