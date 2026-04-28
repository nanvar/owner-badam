"use client";

import { useEffect, useState } from "react";
import {
  FileSpreadsheet,
  FileText,
  Loader2,
  Percent,
  TrendingUp,
  ArrowUpRight,
  CalendarCheck,
  User,
} from "lucide-react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { FadeIn } from "@/components/ui/motion";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import type { Locale } from "@/i18n/config";

export type Brand = {
  name: string;
  legalName: string;
  email: string | null;
  phone: string | null;
  website: string | null;
};

export type Labels = {
  title: string;
  allProperties: string;
  noProperties: string;
  reservations: string;
  thisMonth: string;
  lastMonth: string;
  last30: string;
  last90: string;
  ytd: string;
  kpiRevenue: string;
  kpiNights: string;
  kpiOccupancy: string;
  kpiAdr: string;
  kpiRevpar: string;
  kpiBookings: string;
  kpiAvgStay: string;
  guest: string;
  payout: string;
  loading: string;
  noData: string;
  excel: string;
  pdf: string;
};

const RANGE_OPTIONS = [
  "this-month",
  "last-month",
  "last-30",
  "last-90",
  "ytd",
] as const;

type Kpis = {
  revenue: number;
  payout: number;
  bookings: number;
  nights: number;
  availableNights: number;
  occupancy: number;
  adr: number;
  revpar: number;
  avgStay: number;
};
type Reservation = {
  id: string;
  propertyName: string;
  propertyColor: string;
  guestName: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  pricePerNight: number;
  totalPrice: number;
  cleaningFee: number;
  serviceFee: number;
  taxes: number;
  payout: number;
  currency: string;
};
type ReportData = {
  period: { from: string; to: string };
  kpis: Kpis;
  byProperty: {
    propertyId: string;
    propertyName: string;
    propertyColor: string;
    revenue: number;
    nights: number;
    bookings: number;
  }[];
  reservations: Reservation[];
  propertyCount: number;
};

export function PropertyReport({
  propertyId,
  scopeName,
  ownerName,
  locale,
  brand,
  labels,
}: {
  propertyId: string; // empty string = all properties
  scopeName: string;
  ownerName: string;
  locale: Locale;
  brand: Brand;
  labels: Labels;
}) {
  const [range, setRange] = useState<string>("this-month");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<"excel" | "pdf" | null>(null);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    const sp = new URLSearchParams();
    sp.set("range", range);
    if (propertyId) sp.set("propertyId", propertyId);
    fetch(`/api/report?${sp.toString()}`)
      .then((r) => r.json())
      .then((d: ReportData) => {
        if (!cancel) setData(d);
      })
      .finally(() => !cancel && setLoading(false));
    return () => {
      cancel = true;
    };
  }, [range, propertyId]);

  const rangeLabels: Record<string, string> = {
    "this-month": labels.thisMonth,
    "last-month": labels.lastMonth,
    "last-30": labels.last30,
    "last-90": labels.last90,
    ytd: labels.ytd,
  };

  const exportExcel = async () => {
    if (!data) return;
    setBusy("excel");
    try {
      const xlsx = await import("xlsx");
      const wb = xlsx.utils.book_new();

      const summary = [
        [brand.name, brand.legalName],
        ["Report", `${ownerName} — ${scopeName}`],
        [
          "Period",
          `${formatDate(data.period.from, locale)} → ${formatDate(data.period.to, locale)}`,
        ],
        ["Generated", new Date().toISOString().slice(0, 10)],
        [],
        [labels.kpiRevenue, data.kpis.revenue],
        [labels.kpiNights, data.kpis.nights],
        [labels.kpiOccupancy, `${(data.kpis.occupancy * 100).toFixed(1)}%`],
        [labels.kpiAdr, data.kpis.adr],
        [labels.kpiRevpar, data.kpis.revpar],
        [labels.kpiBookings, data.kpis.bookings],
        [labels.kpiAvgStay, data.kpis.avgStay.toFixed(2)],
        [],
        ["Contact", brand.email ?? ""],
        ["Phone", brand.phone ?? ""],
        ["Website", brand.website ?? ""],
      ];
      xlsx.utils.book_append_sheet(
        wb,
        xlsx.utils.aoa_to_sheet(summary),
        "Summary",
      );

      xlsx.utils.book_append_sheet(
        wb,
        xlsx.utils.json_to_sheet(
          data.reservations.map((r) => ({
            Property: r.propertyName,
            Guest: r.guestName ?? "",
            "Check-in": r.checkIn.slice(0, 10),
            "Check-out": r.checkOut.slice(0, 10),
            Nights: r.nights,
            "Price/night": r.pricePerNight,
            Cleaning: r.cleaningFee,
            Service: r.serviceFee,
            Taxes: r.taxes,
            Total: r.totalPrice,
            Payout: r.payout,
            Currency: r.currency,
          })),
        ),
        "Reservations",
      );

      const slug = scopeName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      xlsx.writeFile(
        wb,
        `${slug}-${data.period.from.slice(0, 10)}_to_${data.period.to.slice(0, 10)}.xlsx`,
      );
    } finally {
      setBusy(null);
    }
  };

  const exportPdf = async () => {
    if (!data) return;
    setBusy("pdf");
    try {
      const { default: jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF({ orientation: "portrait", unit: "pt" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      doc.setFillColor(79, 138, 111);
      doc.rect(0, 0, pageWidth, 80, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(brand.name.toUpperCase(), 32, 28);
      doc.setFontSize(20);
      doc.text("Performance report", 32, 50);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`${ownerName}  ·  ${scopeName}`, 32, 66);

      doc.setTextColor(20, 20, 28);
      doc.setFontSize(10);
      doc.text(
        `${formatDate(data.period.from, locale)} → ${formatDate(data.period.to, locale)}`,
        32,
        108,
      );

      autoTable(doc, {
        startY: 122,
        head: [["Metric", "Value"]],
        theme: "striped",
        headStyles: { fillColor: [243, 247, 244], textColor: [20, 20, 28] },
        body: [
          [labels.kpiRevenue, formatCurrency(data.kpis.revenue, "AED", locale)],
          [labels.kpiNights, `${data.kpis.nights} / ${data.kpis.availableNights}`],
          [labels.kpiOccupancy, `${(data.kpis.occupancy * 100).toFixed(1)}%`],
          [labels.kpiAdr, formatCurrency(data.kpis.adr, "AED", locale)],
          [labels.kpiRevpar, formatCurrency(data.kpis.revpar, "AED", locale)],
          [labels.kpiBookings, String(data.kpis.bookings)],
          [labels.kpiAvgStay, data.kpis.avgStay.toFixed(2)],
        ],
      });

      if (data.reservations.length > 0) {
        autoTable(doc, {
          startY:
            (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16,
          head: [["Property", labels.guest, "In", "Out", "Nights", "Total"]],
          theme: "grid",
          headStyles: { fillColor: [243, 247, 244], textColor: [20, 20, 28] },
          styles: { fontSize: 9 },
          body: data.reservations.map((r) => [
            r.propertyName,
            r.guestName ?? "—",
            r.checkIn.slice(0, 10),
            r.checkOut.slice(0, 10),
            String(r.nights),
            formatCurrency(r.totalPrice, r.currency || "AED", locale),
          ]),
        });
      }

      const totalPages = (
        doc as unknown as { getNumberOfPages: () => number }
      ).getNumberOfPages();
      const contactBits = [
        brand.email,
        brand.phone,
        brand.website?.replace(/^https?:\/\//, ""),
      ]
        .filter(Boolean)
        .join("  ·  ");
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 130);
        doc.text(contactBits, 32, pageHeight - 18);
        doc.text(`${i} / ${totalPages}`, pageWidth - 50, pageHeight - 18);
      }

      const slug = scopeName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      doc.save(
        `${slug}-${data.period.from.slice(0, 10)}_to_${data.period.to.slice(0, 10)}.pdf`,
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* PERIOD CHIPS */}
      <div className="-mx-4 overflow-x-auto px-4 no-scrollbar">
        <div className="flex gap-2 pb-1">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1 text-xs font-semibold transition-all duration-200 active:scale-95",
                range === r
                  ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-white shadow shadow-emerald-700/25"
                  : "border-[var(--color-border)] bg-white text-[var(--color-muted)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]",
              )}
            >
              {rangeLabels[r]}
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <ReportSkeleton />
      ) : data ? (
        <FadeIn delay={0.05}>
          {/* HERO */}
          <div
            className="relative overflow-hidden rounded-3xl border border-[var(--color-border)] p-4 text-white sm:p-5"
            style={{
              background:
                "linear-gradient(135deg, #4f8a6f 0%, #3d6f57 55%, #2f5a47 100%)",
              boxShadow:
                "0 16px 32px -14px rgba(47,90,71,0.4), 0 6px 16px -10px rgba(79,138,111,0.35)",
            }}
          >
            <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-14 -left-10 h-32 w-32 rounded-full bg-emerald-200/20 blur-2xl" />
            <div className="relative">
              <div className="text-[10px] font-medium uppercase tracking-wider text-white/80">
                {labels.kpiRevenue} · {rangeLabels[range] ?? range}
              </div>
              <div className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                <AnimatedNumber
                  value={data.kpis.revenue}
                  format={(v) => formatCurrency(v, "AED", locale)}
                />
              </div>
              <div className="mt-0.5 text-xs text-white/80">
                <AnimatedNumber value={data.kpis.bookings} />{" "}
                {labels.kpiBookings.toLowerCase()} ·{" "}
                <AnimatedNumber value={data.kpis.nights} />{" "}
                {labels.kpiNights.toLowerCase()}
              </div>
            </div>
            <div className="relative mt-3 grid grid-cols-3 gap-2">
              <Mini
                label={labels.kpiOccupancy}
                value={`${(data.kpis.occupancy * 100).toFixed(0)}%`}
                icon={<Percent className="h-3 w-3" />}
              />
              <Mini
                label={labels.kpiAdr}
                value={formatCurrency(data.kpis.adr, "AED", locale)}
                icon={<TrendingUp className="h-3 w-3" />}
              />
              <Mini
                label={labels.kpiRevpar}
                value={formatCurrency(data.kpis.revpar, "AED", locale)}
                icon={<ArrowUpRight className="h-3 w-3" />}
              />
            </div>
          </div>

          {/* SECONDARY KPIs */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <SmallKpi
              label={labels.kpiNights}
              value={`${data.kpis.nights} / ${data.kpis.availableNights}`}
            />
            <SmallKpi label={labels.kpiAvgStay} value={data.kpis.avgStay.toFixed(1)} />
            <SmallKpi
              label={labels.payout}
              value={formatCurrency(data.kpis.payout, "AED", locale)}
            />
          </div>

          {/* RESERVATIONS */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold tracking-tight">
                <CalendarCheck className="-mt-0.5 mr-1 inline h-4 w-4 text-[var(--color-brand)]" />
                {labels.reservations}
              </h3>
              <span className="text-xs text-[var(--color-muted)]">
                {data.reservations.length}
              </span>
            </div>
            {data.reservations.length === 0 ? (
              <div className="grid place-items-center rounded-2xl border border-dashed border-[var(--color-border)] bg-white px-6 py-8 text-sm text-[var(--color-muted)]">
                {labels.noData}
              </div>
            ) : (
              <div className="space-y-2">
                {data.reservations.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-white p-3"
                  >
                    <span
                      className="mt-1 h-7 w-1 shrink-0 rounded-full"
                      style={{ background: r.propertyColor }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-sm font-semibold">
                        <User className="h-3.5 w-3.5 shrink-0 text-[var(--color-muted)]" />
                        <span className="truncate">
                          {r.guestName ?? labels.guest}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-[var(--color-muted)]">
                        {r.propertyName} · {formatDate(r.checkIn, locale)} →{" "}
                        {formatDate(r.checkOut, locale)} · {r.nights}n
                      </div>
                    </div>
                    <div className="text-right text-sm font-bold whitespace-nowrap">
                      {formatCurrency(r.totalPrice, r.currency || "AED", locale)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DOWNLOAD */}
          <div className="sticky bottom-0 -mx-5 -mb-5 mt-5 grid grid-cols-2 gap-2 border-t border-[var(--color-border)] bg-white/95 p-4 backdrop-blur-md">
            <button
              onClick={exportExcel}
              disabled={busy !== null}
              className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white px-3 py-3 text-sm font-semibold transition-colors hover:border-emerald-500 hover:bg-emerald-500/5 disabled:opacity-60"
            >
              {busy === "excel" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              )}
              {labels.excel}
            </button>
            <button
              onClick={exportPdf}
              disabled={busy !== null}
              className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white px-3 py-3 text-sm font-semibold transition-colors hover:border-rose-500 hover:bg-rose-500/5 disabled:opacity-60"
            >
              {busy === "pdf" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 text-rose-500" />
              )}
              {labels.pdf}
            </button>
          </div>
        </FadeIn>
      ) : null}
    </div>
  );
}

function Mini({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-white/15 p-2.5 backdrop-blur-sm">
      <div className="flex items-center gap-1 text-[9px] font-medium uppercase tracking-wider text-white/80">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-0.5 text-sm font-bold sm:text-base">{value}</div>
    </div>
  );
}

function SmallKpi({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white p-3">
      <div className="text-[9px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </div>
      <div className="mt-1 text-sm font-bold">{value}</div>
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-44 w-full" rounded="rounded-3xl" />
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-16 w-full" rounded="rounded-xl" />
        <Skeleton className="h-16 w-full" rounded="rounded-xl" />
        <Skeleton className="h-16 w-full" rounded="rounded-xl" />
      </div>
      <Skeleton className="h-5 w-32" rounded="rounded-md" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" rounded="rounded-xl" />
        ))}
      </div>
    </div>
  );
}
