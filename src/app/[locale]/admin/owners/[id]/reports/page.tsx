import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/app-shell";
import { formatCurrency, formatDate } from "@/lib/utils";
import { NewReportButton } from "./property-picker";

export default async function OwnerReportsPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  await requireRole("ADMIN");
  const loc = locale as Locale;

  const owner = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      properties: {
        select: { id: true, name: true, color: true },
        orderBy: { name: "asc" },
      },
    },
  });
  if (!owner || owner.role !== "OWNER") notFound();

  const reports = await prisma.ownerReport.findMany({
    where: { ownerId: owner.id },
    include: {
      property: { select: { name: true, color: true } },
      _count: { select: { reservations: true, expenses: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <Link
        href={`/${loc}/admin/owners/${owner.id}`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {owner.name ?? owner.email}
      </Link>

      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[var(--color-brand)]" />
            Reports — {owner.name ?? owner.email}
          </span>
        }
        right={
          <NewReportButton
            properties={owner.properties}
            basePath={`/${loc}/admin/reports`}
          />
        }
      />

      {reports.length === 0 ? (
        <Card>
          <CardBody className="py-16 text-center text-sm text-[var(--color-muted)]">
            No reports yet. Click "New report" to bundle this owner's
            reservations and expenses into a settlement.
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
                  <th className="px-4 py-3 text-right font-semibold">Items</th>
                  <th className="px-4 py-3 text-right font-semibold">Income</th>
                  <th className="px-4 py-3 text-right font-semibold">
                    Expenses
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">
                    Net payout
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Created</th>
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
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--color-muted)]">
                      {r._count.reservations} / {r._count.expenses}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCurrency(r.totalIncome, "AED", loc)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-rose-600">
                      {formatCurrency(r.totalExpenses, "AED", loc)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-emerald-700">
                      {formatCurrency(r.netPayout, "AED", loc)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-[var(--color-muted)]">
                      {formatDate(r.createdAt.toISOString(), loc)}
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
