"use client";

import { useEffect, useState } from "react";
import {
  FileSpreadsheet,
  FileText,
  Loader2,
  Receipt,
  Wallet,
  CalendarCheck,
} from "lucide-react";
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
  agencyCommission: number;
  portalCommission: number;
  payout: number;
  currency: string;
};

type ExpenseRow = {
  id: string;
  propertyName: string;
  date: string;
  type: string;
  description: string;
  amount: number;
};

type AdvanceRow = {
  id: string;
  propertyName: string;
  date: string;
  concept: string;
  amount: number;
};

type Settlement = {
  totalAmount: number;
  totalAgency: number;
  totalPortal: number;
  totalOwnerPayout: number;
  totalExpenses: number;
  totalAdvances: number;
  totalDeductions: number;
  settlementTotal: number;
};

type IssuingCompany = {
  brandName: string;
  legalName: string;
  address: string;
  email: string | null;
  phone: string | null;
  website: string | null;
};

type Recipient = {
  name: string;
  email: string;
  phone: string | null;
  taxId: string | null;
  address: string | null;
};

type ReportData = {
  period: { from: string; to: string };
  settlementNo: number;
  settlementDate: string;
  issuingCompany: IssuingCompany;
  recipient: Recipient | null;
  reservations: Reservation[];
  expenses: ExpenseRow[];
  advances: AdvanceRow[];
  settlement: Settlement;
  currency: string;
};

const EXPENSE_TYPE_LABELS: Record<string, string> = {
  DEWA: "DEWA",
  CHILLER: "Chiller",
  DU: "Du",
  GAS: "Gas",
  CLEANING: "Cleaning",
  DTCM: "DTCM Registration",
  SERVICE_CHARGE: "Service Charge",
  OTHERS: "Others",
};

export function PropertyReport({
  propertyId,
  scopeName,
  ownerName,
  locale,
  brand,
  labels,
}: {
  propertyId: string;
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

  const fmt = (n: number) => formatCurrency(n, data?.currency || "AED", locale);

  const exportExcel = async () => {
    if (!data) return;
    setBusy("excel");
    try {
      const xlsx = await import("xlsx");
      const wb = xlsx.utils.book_new();

      const summary: (string | number)[][] = [
        ["Issuing company"],
        [data.issuingCompany.brandName, data.issuingCompany.legalName],
        [data.issuingCompany.address],
        [data.issuingCompany.email ?? "", data.issuingCompany.phone ?? ""],
        [],
        ["Recipient"],
        [data.recipient?.name ?? ownerName],
        [data.recipient?.taxId ?? ""],
        [data.recipient?.email ?? ""],
        [data.recipient?.address ?? ""],
        [],
        ["Settlement N°", data.settlementNo],
        ["Date", data.settlementDate.slice(0, 10)],
        [
          "Period",
          `${formatDate(data.period.from, locale)} → ${formatDate(data.period.to, locale)}`,
        ],
        ["Currency", data.currency],
        ["Scope", scopeName],
        [],
        ["Total income", data.settlement.totalOwnerPayout],
        ["Total deductions", -data.settlement.totalDeductions],
        ["SETTLEMENT TOTAL", data.settlement.settlementTotal],
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
            "Booking ID": r.id,
            Property: r.propertyName,
            Guest: r.guestName ?? "",
            "Stay period": `${r.checkIn.slice(0, 10)} - ${r.checkOut.slice(0, 10)}`,
            Nights: r.nights,
            Amount: r.totalPrice,
            "Agency commission": r.agencyCommission,
            "Portal commission": r.portalCommission,
            "Amount paid to owner": r.payout,
          })),
        ),
        "Bookings",
      );

      xlsx.utils.book_append_sheet(
        wb,
        xlsx.utils.json_to_sheet(
          data.expenses.map((e) => ({
            Date: e.date.slice(0, 10),
            Property: e.propertyName,
            Type: EXPENSE_TYPE_LABELS[e.type] ?? e.type,
            Description: e.description,
            Amount: -e.amount,
          })),
        ),
        "Expenses",
      );

      xlsx.utils.book_append_sheet(
        wb,
        xlsx.utils.json_to_sheet(
          data.advances.map((a) => ({
            Date: a.date.slice(0, 10),
            Property: a.propertyName,
            Concept: a.concept,
            Amount: -a.amount,
          })),
        ),
        "Payments on account",
      );

      const slug = scopeName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      xlsx.writeFile(
        wb,
        `${slug}-settlement-${data.settlementNo}.xlsx`,
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

      // === Header bands: Issuing company (left) + Recipient (right) ===
      const colW = (pageWidth - 64 - 16) / 2;
      const headerY = 50;

      // Left: Issuing company
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(20, 20, 28);
      doc.text("Issuing company", 32, headerY);
      doc.setFontSize(10);
      doc.text(data.issuingCompany.legalName, 32, headerY + 18);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 90);
      doc.setFontSize(9);
      const issAddrLines = doc.splitTextToSize(
        data.issuingCompany.address || "",
        colW,
      );
      doc.text(issAddrLines, 32, headerY + 32);
      const contactBits = [data.issuingCompany.email, data.issuingCompany.phone]
        .filter(Boolean)
        .join("  ·  ");
      if (contactBits) {
        doc.text(contactBits, 32, headerY + 32 + issAddrLines.length * 11);
      }

      // Right: Recipient
      const rightX = 32 + colW + 16;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(20, 20, 28);
      doc.text("Recipient", rightX, headerY);
      doc.setFontSize(10);
      doc.text(
        data.recipient?.name ?? ownerName,
        rightX,
        headerY + 18,
      );
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 90);
      doc.setFontSize(9);
      let rY = headerY + 32;
      if (data.recipient?.taxId) {
        doc.text(data.recipient.taxId, rightX, rY);
        rY += 11;
      }
      if (data.recipient?.email) {
        doc.text(data.recipient.email, rightX, rY);
        rY += 11;
      }
      if (data.recipient?.address) {
        const addrLines = doc.splitTextToSize(data.recipient.address, colW);
        doc.text(addrLines, rightX, rY);
        rY += addrLines.length * 11;
      }

      // === Title bar ===
      const titleY = Math.max(headerY + 90, rY + 20);
      doc.setFillColor(243, 247, 244);
      doc.rect(32, titleY, pageWidth - 64, 30, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(47, 90, 71);
      doc.text(`Seasonal settlement | ${scopeName}`, 44, titleY + 20);

      // === Settlement meta table ===
      autoTable(doc, {
        startY: titleY + 44,
        head: [["Settlement Nº", "Date", "Period", "Currency"]],
        theme: "striped",
        headStyles: { fillColor: [243, 247, 244], textColor: [20, 20, 28] },
        styles: { fontSize: 9 },
        body: [
          [
            String(data.settlementNo),
            data.settlementDate.slice(0, 10),
            `${formatDate(data.period.from, locale)} → ${formatDate(data.period.to, locale)}`,
            data.currency,
          ],
        ],
      });

      let lastY = (doc as unknown as { lastAutoTable: { finalY: number } })
        .lastAutoTable.finalY;

      // === Payments by booking ===
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(20, 20, 28);
      doc.text("Payments by booking", 32, lastY + 22);

      autoTable(doc, {
        startY: lastY + 30,
        head: [
          [
            "Booking",
            "Stay period",
            "Amount",
            "Agency",
            "Portal",
            "To owner",
          ],
        ],
        theme: "striped",
        headStyles: { fillColor: [243, 247, 244], textColor: [20, 20, 28] },
        styles: { fontSize: 8 },
        body: data.reservations.map((r) => [
          r.id.slice(0, 8),
          `${formatDate(r.checkIn, locale)} - ${formatDate(r.checkOut, locale)}`,
          fmt(r.totalPrice),
          fmt(r.agencyCommission),
          fmt(r.portalCommission),
          fmt(r.payout),
        ]),
        foot: [
          [
            "Subtotal:",
            "",
            fmt(data.settlement.totalAmount),
            fmt(data.settlement.totalAgency),
            fmt(data.settlement.totalPortal),
            fmt(data.settlement.totalOwnerPayout),
          ],
        ],
        footStyles: { fillColor: [243, 247, 244], textColor: [20, 20, 28], fontStyle: "bold" },
      });

      lastY = (doc as unknown as { lastAutoTable: { finalY: number } })
        .lastAutoTable.finalY;

      // === Expenses ===
      if (data.expenses.length > 0) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("Expense", 32, lastY + 22);
        autoTable(doc, {
          startY: lastY + 30,
          head: [["Date", "Type / Description", "Amount"]],
          theme: "striped",
          headStyles: { fillColor: [243, 247, 244], textColor: [20, 20, 28] },
          styles: { fontSize: 8 },
          body: data.expenses.map((e) => [
            formatDate(e.date, locale),
            `${EXPENSE_TYPE_LABELS[e.type] ?? e.type} / ${e.description}`,
            `- ${fmt(e.amount)}`,
          ]),
          foot: [["Subtotal:", "", `- ${fmt(data.settlement.totalExpenses)}`]],
          footStyles: { fillColor: [243, 247, 244], textColor: [20, 20, 28], fontStyle: "bold" },
        });
        lastY = (doc as unknown as { lastAutoTable: { finalY: number } })
          .lastAutoTable.finalY;
      }

      // === Payments on account ===
      if (data.advances.length > 0) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("Payments on account", 32, lastY + 22);
        autoTable(doc, {
          startY: lastY + 30,
          head: [["Date", "Concept", "Amount"]],
          theme: "striped",
          headStyles: { fillColor: [243, 247, 244], textColor: [20, 20, 28] },
          styles: { fontSize: 8 },
          body: data.advances.map((a) => [
            formatDate(a.date, locale),
            a.concept,
            `- ${fmt(a.amount)}`,
          ]),
          foot: [["Subtotal:", "", `- ${fmt(data.settlement.totalAdvances)}`]],
          footStyles: { fillColor: [243, 247, 244], textColor: [20, 20, 28], fontStyle: "bold" },
        });
        lastY = (doc as unknown as { lastAutoTable: { finalY: number } })
          .lastAutoTable.finalY;
      }

      // === Summary ===
      autoTable(doc, {
        startY: lastY + 24,
        theme: "grid",
        styles: { fontSize: 9, fontStyle: "bold" },
        body: [
          [
            `Total income: ${fmt(data.settlement.totalOwnerPayout)}`,
            `Total deductions: ${fmt(-data.settlement.totalDeductions)}`,
            `SETTLEMENT TOTAL: ${fmt(data.settlement.settlementTotal)}`,
          ],
        ],
        bodyStyles: { fillColor: [243, 247, 244], textColor: [47, 90, 71] },
      });

      // Footer
      const totalPages = (doc as unknown as {
        getNumberOfPages: () => number;
      }).getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(120, 120, 130);
        const footerBits = [
          data.issuingCompany.email,
          data.issuingCompany.phone,
          data.issuingCompany.website?.replace(/^https?:\/\//, ""),
        ]
          .filter(Boolean)
          .join("  ·  ");
        doc.text(footerBits, 32, pageHeight - 18);
        doc.text(`${i} / ${totalPages}`, pageWidth - 50, pageHeight - 18);
      }

      const slug = scopeName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      doc.save(`${slug}-settlement-${data.settlementNo}.pdf`);
    } finally {
      setBusy(null);
    }
  };

  // Also keep brand variable referenced (typescript noUnusedParameters could complain)
  void brand;

  return (
    <div className="space-y-4">
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
          {/* Settlement header */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Settlement N° {data.settlementNo}
              </div>
              <div className="text-[10px] text-[var(--color-muted)]">
                {data.settlementDate.slice(0, 10)}
              </div>
            </div>
            <div className="mt-1 text-sm font-bold">
              {formatDate(data.period.from, locale)} →{" "}
              {formatDate(data.period.to, locale)}
            </div>
            <div className="text-[11px] text-[var(--color-muted)]">
              {data.issuingCompany.legalName} → {data.recipient?.name ?? ownerName}
              {data.recipient?.taxId && ` (${data.recipient.taxId})`}
            </div>
          </div>

          {/* Section: Bookings */}
          <Section
            title="Payments by booking"
            icon={<CalendarCheck className="h-4 w-4 text-[var(--color-brand)]" />}
            count={data.reservations.length}
          >
            {data.reservations.length === 0 ? (
              <Empty text={labels.noData} />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]">
                <table className="w-full text-xs">
                  <thead className="bg-[var(--color-surface-2)] text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Stay</th>
                      <th className="px-3 py-2 text-right font-semibold">Amount</th>
                      <th className="px-3 py-2 text-right font-semibold">Agency</th>
                      <th className="px-3 py-2 text-right font-semibold">Portal</th>
                      <th className="px-3 py-2 text-right font-semibold">To owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.reservations.map((r) => (
                      <tr
                        key={r.id}
                        className="border-t border-[var(--color-border)]"
                      >
                        <td className="px-3 py-2">
                          <div className="font-semibold">
                            {r.guestName ?? labels.guest}
                          </div>
                          <div className="text-[10px] text-[var(--color-muted)]">
                            {formatDate(r.checkIn, locale)} →{" "}
                            {formatDate(r.checkOut, locale)} · {r.nights}n
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmt(r.totalPrice)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-[var(--color-muted)]">
                          {fmt(r.agencyCommission)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-[var(--color-muted)]">
                          {fmt(r.portalCommission)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-bold">
                          {fmt(r.payout)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-[var(--color-border)] bg-[var(--color-surface-2)]/60">
                      <td className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider">
                        Subtotal
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-bold tabular-nums">
                        {fmt(data.settlement.totalAmount)}
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-bold tabular-nums text-[var(--color-muted)]">
                        {fmt(data.settlement.totalAgency)}
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-bold tabular-nums text-[var(--color-muted)]">
                        {fmt(data.settlement.totalPortal)}
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-bold tabular-nums">
                        {fmt(data.settlement.totalOwnerPayout)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* Section: Expenses */}
          {data.expenses.length > 0 && (
            <Section
              title="Expenses"
              icon={<Receipt className="h-4 w-4 text-rose-500" />}
              count={data.expenses.length}
            >
              <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]">
                <table className="w-full text-xs">
                  <tbody>
                    {data.expenses.map((e) => (
                      <tr
                        key={e.id}
                        className="border-t border-[var(--color-border)] first:border-t-0"
                      >
                        <td className="w-20 whitespace-nowrap px-3 py-2 text-[10px] text-[var(--color-muted)]">
                          {formatDate(e.date, locale)}
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-semibold">
                            {EXPENSE_TYPE_LABELS[e.type] ?? e.type}
                          </div>
                          <div className="text-[10px] text-[var(--color-muted)]">
                            {e.description}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-rose-600">
                          − {fmt(e.amount)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-[var(--color-border)] bg-[var(--color-surface-2)]/60">
                      <td colSpan={2} className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider">
                        Subtotal
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-bold tabular-nums text-rose-600">
                        − {fmt(data.settlement.totalExpenses)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Section: Advances */}
          {data.advances.length > 0 && (
            <Section
              title="Payments on account"
              icon={<Wallet className="h-4 w-4 text-amber-500" />}
              count={data.advances.length}
            >
              <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]">
                <table className="w-full text-xs">
                  <tbody>
                    {data.advances.map((a) => (
                      <tr
                        key={a.id}
                        className="border-t border-[var(--color-border)] first:border-t-0"
                      >
                        <td className="w-20 whitespace-nowrap px-3 py-2 text-[10px] text-[var(--color-muted)]">
                          {formatDate(a.date, locale)}
                        </td>
                        <td className="px-3 py-2 font-semibold">{a.concept}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-rose-600">
                          − {fmt(a.amount)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-[var(--color-border)] bg-[var(--color-surface-2)]/60">
                      <td colSpan={2} className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider">
                        Subtotal
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-bold tabular-nums text-rose-600">
                        − {fmt(data.settlement.totalAdvances)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Summary */}
          <div
            className="rounded-3xl border border-[var(--color-border)] p-4 text-white sm:p-5"
            style={{
              background:
                "linear-gradient(135deg, #4f8a6f 0%, #3d6f57 55%, #2f5a47 100%)",
              boxShadow:
                "0 14px 28px -14px rgba(47,90,71,0.4), 0 4px 12px -6px rgba(79,138,111,0.35)",
            }}
          >
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-white/15 p-3 backdrop-blur-sm">
                <div className="text-[9px] uppercase tracking-wider text-white/80">
                  Total income
                </div>
                <div className="mt-0.5 text-sm font-bold">
                  {fmt(data.settlement.totalOwnerPayout)}
                </div>
              </div>
              <div className="rounded-xl bg-white/15 p-3 backdrop-blur-sm">
                <div className="text-[9px] uppercase tracking-wider text-white/80">
                  Total deductions
                </div>
                <div className="mt-0.5 text-sm font-bold">
                  − {fmt(data.settlement.totalDeductions)}
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl bg-white/20 px-4 py-3 backdrop-blur-sm">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white">
                Settlement total
              </span>
              <span className="text-2xl font-bold">
                {fmt(data.settlement.settlementTotal)}
              </span>
            </div>
          </div>

          {/* Download */}
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

function Section({
  title,
  icon,
  count,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-3 space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-bold tracking-tight">{title}</h3>
        <span className="ml-auto text-[10px] text-[var(--color-muted)]">
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-[var(--color-border)] bg-white px-6 py-8 text-sm text-[var(--color-muted)]">
      {text}
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-20 w-full" rounded="rounded-2xl" />
      <Skeleton className="h-5 w-40" rounded="rounded-md" />
      <Skeleton className="h-48 w-full" rounded="rounded-2xl" />
      <Skeleton className="h-5 w-32" rounded="rounded-md" />
      <Skeleton className="h-32 w-full" rounded="rounded-2xl" />
      <Skeleton className="h-32 w-full" rounded="rounded-3xl" />
    </div>
  );
}
