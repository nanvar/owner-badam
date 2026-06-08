import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { FileText, ChevronRight, Receipt, CheckCircle2, Clock } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/utils";
import { SoftCard } from "@/components/owner/v2/primitives";
import { EmptyState } from "@/components/owner/empty-state";

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
      _count: {
        select: { reservations: true, extensions: true, expenses: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const totalNet = reports.reduce((s, r) => s + r.netPayout, 0);
  // Split totals so the header shows what's actually outstanding vs
  // what's already settled — matches the admin Paid/Unpaid tabs.
  const totalOutstanding = reports
    .filter((r) => !r.paidAt)
    .reduce((s, r) => s + r.netPayout, 0);
  const totalSettled = reports
    .filter((r) => !!r.paidAt)
    .reduce((s, r) => s + r.netPayout, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between px-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">
            Settlement reports prepared by management.
          </p>
        </div>
        {reports.length > 0 && (
          <div className="text-right">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Outstanding · Paid
            </div>
            <div className="flex items-baseline justify-end gap-2 text-lg font-bold tabular-nums">
              <span className="text-amber-700">
                {formatCurrency(totalOutstanding, "AED", loc)}
              </span>
              <span className="text-[var(--color-muted)]">·</span>
              <span className="text-emerald-700">
                {formatCurrency(totalSettled, "AED", loc)}
              </span>
            </div>
          </div>
        )}
      </div>

      {reports.length === 0 ? (
        <EmptyState
          title="No reports yet"
          description="Your manager will share settlement reports here as they're prepared."
          illustration="/illustrations/owner-reports-empty.svg"
          icon={<FileText className="h-7 w-7" />}
        />
      ) : (
        <ul className="space-y-2">
          {reports.map((r) => (
            <SoftCard
              key={r.id}
              as="li"
              href={`/${loc}/owner/reports/${r.id}`}
              className="!p-3"
            >
              <div className="flex items-center gap-3">
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white"
                  style={{ background: r.property.color }}
                >
                  <FileText className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="truncate text-sm font-bold tracking-tight">
                      {r.name}
                    </div>
                    <div
                      className={`text-base font-bold tabular-nums ${
                        r.netPayout >= 0 ? "text-emerald-700" : "text-rose-600"
                      }`}
                    >
                      {formatCurrency(r.netPayout, "AED", loc)}
                    </div>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-muted)]">
                    <span className="truncate">{r.property.name}</span>
                    <span>·</span>
                    <span>{formatDate(r.createdAt.toISOString(), loc)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--color-muted)]">
                    <span>
                      {r._count.reservations} reservations
                      {r._count.extensions > 0 && (
                        <span className="text-sky-700">
                          {" "}
                          +{r._count.extensions} ext
                        </span>
                      )}
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                      <Receipt className="h-3 w-3" />
                      {r._count.expenses}
                    </span>
                    {r.paidAt ? (
                      <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" />
                        Paid {formatDate(r.paidAt.toISOString(), loc)}
                      </span>
                    ) : (
                      <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        <Clock className="h-3 w-3" />
                        Awaiting payout
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-muted)]" />
              </div>
            </SoftCard>
          ))}
        </ul>
      )}
    </div>
  );
}
