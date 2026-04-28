"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  FileSpreadsheet,
  FileText,
  Loader2,
  Download,
  Building2,
  CalendarRange,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Field } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/app-shell";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/config";

type Property = { id: string; name: string };
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
  cleaningFees: number;
};
type ReservationRow = {
  id: string;
  propertyId: string;
  propertyName: string;
  propertyColor: string;
  guestName: string | null;
  numGuests: number | null;
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
  detailsFilled: boolean;
};
type ReportData = {
  period: { from: string; to: string };
  kpis: Kpis;
  byProperty: { propertyId: string; propertyName: string; propertyColor: string; revenue: number; nights: number; bookings: number }[];
  reservations: ReservationRow[];
  propertyCount: number;
};

type Tab = "overview" | "byProperty" | "reservations";

const RANGE_OPTIONS = [
  "this-month",
  "last-month",
  "last-30",
  "last-90",
  "ytd",
] as const;

type Brand = {
  name: string;
  legalName: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  address: string | null;
};

export function ReportsView({
  locale,
  ownerName,
  properties,
  brand,
  labels,
}: {
  locale: Locale;
  ownerName: string;
  properties: Property[];
  brand: Brand;
  labels: Record<string, string>;
}) {
  const searchParams = useSearchParams();

  const [range, setRange] = useState(searchParams.get("range") ?? "this-month");
  const [propertyId, setPropertyId] = useState<string>(
    searchParams.get("propertyId") ?? "",
  );
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [exportOpen, setExportOpen] = useState(false);

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("range", range);
    if (propertyId) sp.set("propertyId", propertyId);
    return sp.toString();
  }, [range, propertyId]);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    fetch(`/api/report?${queryString}`)
      .then((r) => r.json())
      .then((d: ReportData) => {
        if (!cancel) setData(d);
      })
      .finally(() => !cancel && setLoading(false));
    return () => {
      cancel = true;
    };
  }, [queryString]);

  const rangeLabels: Record<string, string> = {
    "this-month": labels.thisMonth,
    "last-month": labels.lastMonth,
    "last-30": labels.last30,
    "last-90": labels.last90,
    ytd: labels.ytd,
    custom: labels.custom,
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={labels.title}
        right={
          <Button onClick={() => setExportOpen(true)}>
            <Download className="h-4 w-4" />
            {labels.exportLabel ?? "Export"}
          </Button>
        }
      />

      {/* FILTER ROW */}
      <div className="space-y-3">
        <div className="-mx-4 overflow-x-auto px-4 no-scrollbar">
          <div className="flex gap-2 pb-1">
            {RANGE_OPTIONS.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors",
                  range === r
                    ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-white shadow-sm shadow-emerald-700/25"
                    : "border-[var(--color-border)] bg-white text-[var(--color-muted)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]",
                )}
              >
                {rangeLabels[r]}
              </button>
            ))}
          </div>
        </div>
        <div className="relative">
          <Building2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
          <select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            className="h-10 w-full appearance-none rounded-xl border border-[var(--color-border)] bg-white pl-10 pr-9 text-sm font-medium focus:border-[var(--color-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/30"
          >
            <option value="">
              {labels.all} ({properties.length})
            </option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <svg
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      </div>

      {loading && !data && <ReportSkeleton />}

      {data && (
        <>
          {/* TAB BAR */}
          <div className="flex rounded-xl border border-[var(--color-border)] bg-white p-1 text-sm">
            <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>
              {labels.tabOverview ?? "Overview"}
            </TabButton>
            <TabButton active={tab === "byProperty"} onClick={() => setTab("byProperty")}>
              {labels.byProperty}
            </TabButton>
            <TabButton active={tab === "reservations"} onClick={() => setTab("reservations")}>
              {labels.reservationsLabel}
            </TabButton>
          </div>

          {/* TAB CONTENT */}
          {tab === "overview" && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <CalendarRange className="-mt-0.5 mr-1.5 inline h-4 w-4" />
                  {formatDate(data.period.from, locale)} → {formatDate(data.period.to, locale)}
                </CardTitle>
              </CardHeader>
              <CardBody className="space-y-3 text-sm">
                <Row
                  label={labels.kpiRevenue}
                  value={formatCurrency(data.kpis.revenue, "AED", locale)}
                  emphasis
                />
                <Row label={labels.payout} value={formatCurrency(data.kpis.payout, "AED", locale)} />
                <Row label={labels.kpiBookings} value={data.kpis.bookings} />
                <Row label={labels.kpiNights} value={`${data.kpis.nights} / ${data.kpis.availableNights}`} />
                <Row label={labels.kpiOccupancy} value={`${(data.kpis.occupancy * 100).toFixed(1)}%`} />
                <Row label={labels.kpiAdr} value={formatCurrency(data.kpis.adr, "AED", locale)} hint={labels.kpiAdrFull} />
                <Row label={labels.kpiRevpar} value={formatCurrency(data.kpis.revpar, "AED", locale)} hint={labels.kpiRevparFull} />
                <Row label={labels.kpiAvgStay} value={data.kpis.avgStay.toFixed(2)} />
              </CardBody>
            </Card>
          )}

          {tab === "byProperty" && (
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>{labels.byProperty}</CardTitle>
              </CardHeader>
              <CardBody className="p-0">
                {data.byProperty.length === 0 ? (
                  <p className="px-5 py-12 text-center text-sm text-[var(--color-muted)]">
                    {labels.noData}
                  </p>
                ) : (
                  <div className="divide-y divide-[var(--color-border)]">
                    {data.byProperty.map((p) => {
                      const max = data.byProperty[0]?.revenue || 1;
                      const pct = (p.revenue / max) * 100;
                      return (
                        <button
                          key={p.propertyId}
                          onClick={() => setPropertyId(p.propertyId)}
                          className="group block w-full px-5 py-4 text-left transition-colors hover:bg-[var(--color-surface-2)]/60"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ background: p.propertyColor }}
                              />
                              <span className="truncate font-semibold">{p.propertyName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold">
                                {formatCurrency(p.revenue, "AED", locale)}
                              </span>
                              <ChevronRight className="h-4 w-4 text-[var(--color-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-brand)]" />
                            </div>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, background: p.propertyColor }}
                            />
                          </div>
                          <div className="mt-2 flex items-center gap-3 text-xs text-[var(--color-muted)]">
                            <span>
                              {p.bookings} {labels.kpiBookings.toLowerCase()}
                            </span>
                            <span>·</span>
                            <span>
                              {p.nights} {labels.kpiNights.toLowerCase()}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {tab === "reservations" && (
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>
                  {labels.reservationsLabel} · {data.reservations.length}
                </CardTitle>
              </CardHeader>
              <CardBody className="p-0">
                {data.reservations.length === 0 ? (
                  <p className="px-5 py-12 text-center text-sm text-[var(--color-muted)]">
                    {labels.noData}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[var(--color-surface-2)] text-xs uppercase tracking-wider text-[var(--color-muted)]">
                        <tr>
                          <th className="px-5 py-3 text-left font-semibold">{labels.property}</th>
                          <th className="px-4 py-3 text-left font-semibold">{labels.guest}</th>
                          <th className="px-4 py-3 text-left font-semibold">In</th>
                          <th className="px-4 py-3 text-left font-semibold">Out</th>
                          <th className="px-4 py-3 text-right font-semibold">N</th>
                          <th className="px-4 py-3 text-right font-semibold">{labels.kpiRevenue}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.reservations.map((r) => (
                          <tr
                            key={r.id}
                            onClick={() => setPropertyId(r.propertyId)}
                            className="cursor-pointer border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]/60"
                          >
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <span
                                  className="h-6 w-1 shrink-0 rounded-full"
                                  style={{ background: r.propertyColor }}
                                />
                                <span className="truncate font-medium">{r.propertyName}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">{r.guestName ?? "—"}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-[var(--color-muted)]">
                              {formatDate(r.checkIn, locale)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-[var(--color-muted)]">
                              {formatDate(r.checkOut, locale)}
                            </td>
                            <td className="px-4 py-3 text-right">{r.nights}</td>
                            <td className="px-4 py-3 text-right font-semibold">
                              {formatCurrency(r.totalPrice, r.currency || "AED", locale)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardBody>
            </Card>
          )}
        </>
      )}

      <ExportDrawer
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        defaultRange={range}
        defaultPropertyId={propertyId}
        properties={properties}
        ownerName={ownerName}
        brand={brand}
        locale={locale}
        labels={labels}
      />
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex gap-2 rounded-xl border border-[var(--color-border)] bg-white p-1">
        <Skeleton className="h-9 flex-1 rounded-lg" />
        <Skeleton className="h-9 flex-1 rounded-lg" />
        <Skeleton className="h-9 flex-1 rounded-lg" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardBody className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between border-b border-[var(--color-border)] pb-3 last:border-0 last:pb-0"
            >
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

function ExportDrawer({
  open,
  onClose,
  defaultRange,
  defaultPropertyId,
  properties,
  ownerName,
  brand,
  locale,
  labels,
}: {
  open: boolean;
  onClose: () => void;
  defaultRange: string;
  defaultPropertyId: string;
  properties: Property[];
  ownerName: string;
  brand: Brand;
  locale: Locale;
  labels: Record<string, string>;
}) {
  const [range, setRange] = useState(defaultRange);
  const [propertyId, setPropertyId] = useState<string>(defaultPropertyId);
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [from, setFrom] = useState<string>(firstOfMonth.toISOString().slice(0, 10));
  const [to, setTo] = useState<string>(today.toISOString().slice(0, 10));
  const [busy, setBusy] = useState<"excel" | "pdf" | null>(null);

  useEffect(() => {
    if (open) {
      setRange(defaultRange);
      setPropertyId(defaultPropertyId);
    }
  }, [open, defaultRange, defaultPropertyId]);

  const propertyName = propertyId
    ? properties.find((p) => p.id === propertyId)?.name ?? ""
    : labels.all;

  const fetchData = async (): Promise<ReportData | null> => {
    const sp = new URLSearchParams();
    sp.set("range", range);
    if (range === "custom") {
      sp.set("from", from);
      sp.set("to", to);
    }
    if (propertyId) sp.set("propertyId", propertyId);
    const res = await fetch(`/api/report?${sp.toString()}`);
    if (!res.ok) return null;
    return res.json();
  };

  const exportExcel = async () => {
    setBusy("excel");
    try {
      const data = await fetchData();
      if (!data) return;
      const xlsx = await import("xlsx");
      const wb = xlsx.utils.book_new();

      const summary = [
        [brand.name, brand.legalName],
        ["Report", `${ownerName} — ${propertyName}`],
        ["Period", `${formatDate(data.period.from, locale)} → ${formatDate(data.period.to, locale)}`],
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
      const wsSummary = xlsx.utils.aoa_to_sheet(summary);
      xlsx.utils.book_append_sheet(wb, wsSummary, "Summary");

      const wsByProp = xlsx.utils.json_to_sheet(
        data.byProperty.map((p) => ({
          Property: p.propertyName,
          Revenue: p.revenue,
          Nights: p.nights,
          Bookings: p.bookings,
        })),
      );
      xlsx.utils.book_append_sheet(wb, wsByProp, "By property");

      const wsRows = xlsx.utils.json_to_sheet(
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
      );
      xlsx.utils.book_append_sheet(wb, wsRows, "Reservations");

      xlsx.writeFile(
        wb,
        `pms-report-${data.period.from.slice(0, 10)}_to_${data.period.to.slice(0, 10)}.xlsx`,
      );
      onClose();
    } finally {
      setBusy(null);
    }
  };

  const exportPdf = async () => {
    setBusy("pdf");
    try {
      const data = await fetchData();
      if (!data) return;
      const { default: jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF({ orientation: "portrait", unit: "pt" });
      const pageWidth = doc.internal.pageSize.getWidth();

      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFillColor(99, 102, 241);
      doc.rect(0, 0, pageWidth, 80, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(brand.name.toUpperCase(), 32, 28);
      doc.setFontSize(20);
      doc.text("Performance report", 32, 50);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`${ownerName}  ·  ${propertyName}`, 32, 66);

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
        headStyles: { fillColor: [241, 243, 248], textColor: [20, 20, 28] },
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

      if (data.byProperty.length > 0) {
        autoTable(doc, {
          startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16,
          head: [[labels.property || "Property", "Revenue", "Nights", "Bookings"]],
          theme: "striped",
          headStyles: { fillColor: [241, 243, 248], textColor: [20, 20, 28] },
          body: data.byProperty.map((p) => [
            p.propertyName,
            formatCurrency(p.revenue, "AED", locale),
            String(p.nights),
            String(p.bookings),
          ]),
        });
      }

      if (data.reservations.length > 0) {
        autoTable(doc, {
          startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16,
          head: [["Property", labels.guest, "In", "Out", "Nights", "Total"]],
          theme: "grid",
          headStyles: { fillColor: [241, 243, 248], textColor: [20, 20, 28] },
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

      const totalPages = (doc as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
      const contactBits = [brand.email, brand.phone, brand.website?.replace(/^https?:\/\//, "")]
        .filter(Boolean)
        .join("  ·  ");
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 130);
        doc.text(contactBits, 32, pageHeight - 18);
        doc.text(`${i} / ${totalPages}`, pageWidth - 50, pageHeight - 18);
      }

      const slug = brand.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      doc.save(
        `${slug}-report-${data.period.from.slice(0, 10)}_to_${data.period.to.slice(0, 10)}.pdf`,
      );
      onClose();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      side="right"
      title={labels.exportLabel ?? "Export"}
      description={labels.exportHint ?? "Pick the period, property and format."}
    >
      <div className="space-y-5">
        {/* Period */}
        <Field label={labels.period}>
          <div className="flex flex-wrap gap-2">
            {(["this-month", "last-month", "last-30", "last-90", "ytd", "custom"] as const).map(
              (r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                    range === r
                      ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-white"
                      : "border-[var(--color-border)] bg-white text-[var(--color-muted)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]",
                  )}
                >
                  {r === "this-month"
                    ? labels.thisMonth
                    : r === "last-month"
                      ? labels.lastMonth
                      : r === "last-30"
                        ? labels.last30
                        : r === "last-90"
                          ? labels.last90
                          : r === "ytd"
                            ? labels.ytd
                            : labels.custom}
                </button>
              ),
            )}
          </div>
        </Field>

        {range === "custom" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={labels.from}>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label={labels.to}>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
        )}

        {/* Property */}
        <Field label={labels.property}>
          <div className="relative">
            <Building2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className="h-11 w-full appearance-none rounded-xl border border-[var(--color-border)] bg-white pl-10 pr-9 text-sm font-medium text-[var(--color-foreground)] focus:border-[var(--color-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/30"
            >
              <option value="">{labels.all} ({properties.length})</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
        </Field>

        {/* Summary chip */}
        <div className="flex items-center gap-2 rounded-2xl bg-[var(--color-brand-soft)] px-4 py-3 text-sm text-[var(--color-brand)]">
          <CalendarRange className="h-4 w-4 shrink-0" />
          <div className="font-semibold">
            {range === "custom"
              ? `${formatDate(from, locale)} → ${formatDate(to, locale)}`
              : labels[
                  range === "this-month"
                    ? "thisMonth"
                    : range === "last-month"
                      ? "lastMonth"
                      : range === "last-30"
                        ? "last30"
                        : range === "last-90"
                          ? "last90"
                          : "ytd"
                ]}{" "}
            · {propertyName}
          </div>
        </div>

        {/* Format buttons */}
        <div className="grid gap-2">
          <button
            onClick={exportExcel}
            disabled={busy !== null}
            className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3.5 text-left transition-colors hover:border-emerald-500 hover:bg-emerald-500/5 disabled:opacity-60"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <FileSpreadsheet className="h-5 w-5" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-semibold">Excel</span>
              <span className="block text-xs text-[var(--color-muted)]">
                .xlsx · 3 sheets (Summary, By property, Reservations)
              </span>
            </span>
            {busy === "excel" ? (
              <Loader2 className="h-4 w-4 animate-spin text-[var(--color-muted)]" />
            ) : (
              <Download className="h-4 w-4 text-[var(--color-muted)]" />
            )}
          </button>
          <button
            onClick={exportPdf}
            disabled={busy !== null}
            className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3.5 text-left transition-colors hover:border-rose-500 hover:bg-rose-500/5 disabled:opacity-60"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-rose-500/10 text-rose-600">
              <FileText className="h-5 w-5" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-semibold">PDF</span>
              <span className="block text-xs text-[var(--color-muted)]">
                .pdf · printable summary
              </span>
            </span>
            {busy === "pdf" ? (
              <Loader2 className="h-4 w-4 animate-spin text-[var(--color-muted)]" />
            ) : (
              <Download className="h-4 w-4 text-[var(--color-muted)]" />
            )}
          </button>
        </div>
      </div>
    </Sheet>
  );
}


function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors sm:text-sm",
        active
          ? "bg-[var(--color-brand)] text-white shadow-sm shadow-emerald-700/25"
          : "text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-foreground)]",
      )}
    >
      {children}
    </button>
  );
}

function Row({
  label,
  value,
  hint,
  emphasis,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3 last:border-0 last:pb-0">
      <div>
        <div className={cn("text-sm", emphasis ? "font-semibold" : "text-[var(--color-muted)]")}>
          {label}
        </div>
        {hint && <div className="text-xs text-[var(--color-muted)]">{hint}</div>}
      </div>
      <div className={cn(emphasis ? "text-lg font-bold" : "text-sm font-semibold")}>
        {value}
      </div>
    </div>
  );
}
