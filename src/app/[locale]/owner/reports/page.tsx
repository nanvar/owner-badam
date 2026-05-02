import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/app-shell";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function OwnerReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const session = await requireRole("OWNER");
  const loc = locale as Locale;

  const reports = await prisma.ownerReport.findMany({
    where: { ownerId: session.userId },
    include: {
      property: { select: { name: true, color: true } },
      _count: { select: { reservations: true, expenses: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader title="Reports" />
      {reports.length === 0 ? (
        <Card>
          <CardBody className="py-16 text-center text-sm text-[var(--color-muted)]">
            No reports yet. Your manager will share settlement reports here as
            they're prepared.
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {reports.map((r) => (
            <Link
              key={r.id}
              href={`/${loc}/owner/reports/${r.id}`}
              className="group"
            >
              <Card className="overflow-hidden transition-shadow group-hover:shadow-lg">
                <CardBody>
                  <div className="flex items-center gap-3">
                    <span
                      className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--color-brand-soft)] text-[var(--color-brand)]"
                    >
                      <FileText className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-bold tracking-tight">
                        {r.name}
                      </div>
                      <div className="truncate text-xs text-[var(--color-muted)]">
                        {r.property.name} ·{" "}
                        {formatDate(r.createdAt.toISOString(), loc)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-baseline justify-between gap-3">
                    <div className="text-xs text-[var(--color-muted)]">
                      {r._count.reservations} reservations ·{" "}
                      {r._count.expenses} expenses
                    </div>
                    <div className="text-lg font-bold tabular-nums text-emerald-700">
                      {formatCurrency(r.netPayout, "AED", loc)}
                    </div>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
