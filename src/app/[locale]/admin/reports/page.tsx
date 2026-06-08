import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Plus, FileText, CheckCircle2 } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/app-shell";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ReportsPropertyFilter } from "./property-filter";
import { ReportPayButton } from "./report-pay-button";

type StatusTab = "unpaid" | "paid";

export default async function AdminReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ propertyId?: string; status?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  await requireRole("ADMIN");
  const loc = locale as Locale;
  const sp = await searchParams;

  const status: StatusTab = sp.status === "paid" ? "paid" : "unpaid";

  const properties = await prisma.property.findMany({
    select: {
      id: true,
      name: true,
      color: true,
      owner: { select: { name: true, email: true } },
    },
    orderBy: { name: "asc" },
  });

  const filterPropertyId =
    sp.propertyId && properties.some((p) => p.id === sp.propertyId)
      ? sp.propertyId
      : "";

  // Build the base where clause from the property filter, then split
  // into two queries so each tab carries its own count for the badges.
  const propertyWhere = filterPropertyId ? { propertyId: filterPropertyId } : {};
  const [unpaidCount, paidCount, reports] = await Promise.all([
    prisma.ownerReport.count({ where: { ...propertyWhere, paidAt: null } }),
    prisma.ownerReport.count({
      where: { ...propertyWhere, paidAt: { not: null } },
    }),
    prisma.ownerReport.findMany({
      where: {
        ...propertyWhere,
        paidAt: status === "paid" ? { not: null } : null,
      },
      include: {
        property: { select: { name: true, color: true } },
        owner: { select: { name: true, email: true } },
        _count: {
          select: { reservations: true, extensions: true, expenses: true },
        },
      },
      orderBy:
        status === "paid"
          ? { paidAt: "desc" }
          : { createdAt: "desc" },
    }),
  ]);

  const baseQuery = (s: StatusTab) => {
    const params = new URLSearchParams();
    params.set("status", s);
    if (filterPropertyId) params.set("propertyId", filterPropertyId);
    return `/${loc}/admin/reports?${params.toString()}`;
  };

  return (
    <div>
      <PageHeader
        title="Reports"
        right={
          <Link href={`/${loc}/admin/reports/new`}>
            <Button>
              <Plus className="h-4 w-4" />
              New report
            </Button>
          </Link>
        }
      />

      <ReportsPropertyFilter
        properties={properties.map((p) => ({
          id: p.id,
          name: p.name,
          color: p.color,
          ownerName: p.owner.name ?? p.owner.email,
        }))}
        selectedPropertyId={filterPropertyId}
        basePath={`/${loc}/admin/reports`}
      />

      {/* Status tabs — unpaid / paid. Reuses link-style nav so the URL
          stays bookmarkable and back-navigation works as expected. */}
      <div className="mb-3 inline-flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/50 p-1">
        <StatusTabLink
          href={baseQuery("unpaid")}
          active={status === "unpaid"}
          label="Unpaid"
          count={unpaidCount}
        />
        <StatusTabLink
          href={baseQuery("paid")}
          active={status === "paid"}
          label="Paid"
          count={paidCount}
        />
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardBody className="py-16 text-center text-sm text-[var(--color-muted)]">
            {status === "paid"
              ? "No paid reports yet."
              : filterPropertyId
                ? "No unpaid reports for this property."
                : "No unpaid reports. Click \"New report\" to bundle items for an owner."}
          </CardBody>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="grid-table w-full text-sm">
              <thead className="bg-[var(--color-surface-2)] text-xs uppercase tracking-wider text-[var(--color-muted)]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Property</th>
                  <th className="px-4 py-3 text-left font-semibold">Owner</th>
                  <th className="px-4 py-3 text-right font-semibold">Items</th>
                  <th className="px-4 py-3 text-right font-semibold">Income</th>
                  <th className="px-4 py-3 text-right font-semibold">Expenses</th>
                  <th className="px-4 py-3 text-right font-semibold">Net payout</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    {status === "paid" ? "Paid on" : "Created"}
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]/60"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/${loc}/admin/reports/${r.id}`}
                        className="inline-flex items-center gap-2 font-semibold hover:text-[var(--color-brand)]"
                      >
                        <FileText className="h-4 w-4 text-[var(--color-muted)]" />
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-6 w-1 shrink-0 rounded-full"
                          style={{ background: r.property.color }}
                        />
                        <span>{r.property.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">
                      {r.owner.name ?? r.owner.email}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--color-muted)]">
                      {r._count.reservations}
                      {r._count.extensions > 0 && (
                        <span className="text-sky-700">
                          {" "}
                          +{r._count.extensions}
                        </span>
                      )}{" "}
                      / {r._count.expenses}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCurrency(r.totalIncome, "AED", loc)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-rose-600">
                      {formatCurrency(r.totalExpenses, "AED", loc)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-bold tabular-nums ${r.netPayout >= 0 ? "text-emerald-700" : "text-rose-600"}`}
                    >
                      {formatCurrency(r.netPayout, "AED", loc)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-[var(--color-muted)]">
                      {formatDate(
                        (r.paidAt ?? r.createdAt).toISOString(),
                        loc,
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.paidAt ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" />
                          {paidMethodLabel(r.paidMethod)}
                        </span>
                      ) : (
                        <ReportPayButton
                          reportId={r.id}
                          reportName={r.name}
                          amount={r.netPayout}
                          locale={loc}
                          ownerName={r.owner.name ?? r.owner.email}
                          propertyName={r.property.name}
                        />
                      )}
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

function StatusTabLink({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-[var(--color-foreground)] shadow-sm"
          : "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--color-muted)] transition-colors hover:bg-white/60 hover:text-[var(--color-foreground)]"
      }
    >
      {label}
      <span
        className={
          active
            ? "rounded-full bg-[var(--color-brand-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-brand)]"
            : "rounded-full bg-[var(--color-border)]/50 px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-muted)]"
        }
      >
        {count}
      </span>
    </Link>
  );
}

function paidMethodLabel(m: string | null): string {
  if (!m) return "Paid";
  if (m === "bank_transfer") return "Bank transfer";
  if (m === "cash") return "Cash";
  if (m === "card") return "Card";
  return m;
}
