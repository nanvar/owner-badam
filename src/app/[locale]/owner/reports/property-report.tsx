"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  Loader2,
  Receipt,
  Wallet,
  CalendarCheck,
  ChevronDown,
} from "lucide-react";
import { FadeIn } from "@/components/ui/motion";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import type { Locale } from "@/i18n/config";

export type Labels = {
  title: string;
  allProperties: string;
  noProperties: string;
  reservations: string;
  guest: string;
  payout: string;
  loading: string;
  noData: string;
  pdf: string;
  selectMonth: string;
  noMonthsAvailable: string;
  monthlySettlement: string;
  paymentsByBooking: string;
  expensesSection: string;
  paymentsOnAccount: string;
  stay: string;
  agency: string;
  portal: string;
  toOwner: string;
  subtotal: string;
  totalIncome: string;
  totalDeductions: string;
  settlementTotal: string;
  amount: string;
  date: string;
  type: string;
  description: string;
  concept: string;
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
  logoUrl: string | null;
  logoDataUrl: string | null;
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

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

// jsPDF's built-in helvetica only covers Latin. Roboto supports Latin + Cyrillic
// + Latin Extended, which is what we need for Russian month names and any
// non-ASCII content (guest names, addresses, expense descriptions).
// DejaVu Sans is the most reliable Cyrillic-capable TTF for jsPDF — its CMap
// is parsed cleanly by jsPDF's TrueType loader, unlike Roboto's modern static
// variants which jsPDF can fail to map correctly even with Identity-H encoding.
const FONT_REGULAR_URL =
  "https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.0/ttf/DejaVuSans.ttf";
const FONT_BOLD_URL =
  "https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.0/ttf/DejaVuSans-Bold.ttf";

let cachedFonts: { regular: string; bold: string } | null | undefined;

async function loadFontBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("font fetch failed");
  const buf = new Uint8Array(await res.arrayBuffer());
  const CHUNK = 0x8000;
  let bin = "";
  for (let i = 0; i < buf.length; i += CHUNK) {
    bin += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

async function loadCyrillicFonts() {
  if (cachedFonts !== undefined) return cachedFonts;
  try {
    const [regular, bold] = await Promise.all([
      loadFontBase64(FONT_REGULAR_URL),
      loadFontBase64(FONT_BOLD_URL),
    ]);
    cachedFonts = { regular, bold };
  } catch {
    cachedFonts = null;
  }
  return cachedFonts;
}

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}

// List YYYY-MM keys from the createdAt month up through the last completed
// month (i.e. the month before the current one, in UTC). Returns newest first.
function buildAvailableMonths(createdAtIso: string | null): string[] {
  if (!createdAtIso) return [];
  const created = new Date(createdAtIso);
  const startY = created.getUTCFullYear();
  const startM = created.getUTCMonth(); // 0-based

  const now = new Date();
  // Last completed month = previous calendar month
  let endY = now.getUTCFullYear();
  let endM = now.getUTCMonth() - 1;
  if (endM < 0) {
    endM = 11;
    endY -= 1;
  }

  if (endY < startY || (endY === startY && endM < startM)) return [];

  const out: string[] = [];
  let y = startY;
  let m = startM;
  while (y < endY || (y === endY && m <= endM)) {
    out.push(`${y}-${pad2(m + 1)}`);
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return out.reverse();
}

function formatMonthLabel(monthStr: string, locale: Locale) {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function PropertyReport({
  propertyId,
  scopeName,
  scopeCreatedAt,
  ownerName,
  locale,
  labels,
}: {
  propertyId: string;
  scopeName: string;
  scopeCreatedAt: string | null;
  ownerName: string;
  locale: Locale;
  labels: Labels;
}) {
  const availableMonths = useMemo(
    () => buildAvailableMonths(scopeCreatedAt),
    [scopeCreatedAt],
  );
  const [month, setMonth] = useState<string>(availableMonths[0] ?? "");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<"pdf" | null>(null);

  useEffect(() => {
    if (!month) {
      setData(null);
      return;
    }
    let cancel = false;
    setLoading(true);
    const sp = new URLSearchParams();
    sp.set("month", month);
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
  }, [month, propertyId]);

  const fmt = (n: number) => formatCurrency(n, data?.currency || "AED", locale);

  const exportPdf = async () => {
    if (!data) return;
    setBusy("pdf");
    try {
      const { default: jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF({ orientation: "portrait", unit: "pt" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 40;
      const innerW = pageWidth - margin * 2;
      const center = pageWidth / 2;

      // Register a Cyrillic-capable font (Roboto). If CDN fetch fails, we
      // fall back to helvetica which only renders Latin glyphs.
      // Identity-H encoding is required so jsPDF uses the font's Unicode CMap
      // instead of WinAnsi (which would strip the high byte of Cyrillic chars).
      const fonts = await loadCyrillicFonts();
      let FONT = "helvetica";
      if (fonts) {
        doc.addFileToVFS("DejaVuSans.ttf", fonts.regular);
        doc.addFont("DejaVuSans.ttf", "DejaVuSans", "normal");
        doc.addFileToVFS("DejaVuSans-Bold.ttf", fonts.bold);
        doc.addFont("DejaVuSans-Bold.ttf", "DejaVuSans", "bold");
        FONT = "DejaVuSans";
      }

      // ---- 1. Use pre-fetched server-side base64 logo ----
      let logo: { dataUrl: string; format: string; w: number; h: number } | null =
        null;
      if (data.issuingCompany.logoDataUrl) {
        try {
          const dataUrl = data.issuingCompany.logoDataUrl;
          const mimeMatch = /^data:([^;]+);base64,/.exec(dataUrl);
          const mime = mimeMatch ? mimeMatch[1] : "image/png";
          const format = /jpeg|jpg/i.test(mime) ? "JPEG" : "PNG";
          const dims = await new Promise<{ w: number; h: number }>(
            (resolve, reject) => {
              const img = new window.Image();
              img.onload = () =>
                resolve({ w: img.naturalWidth, h: img.naturalHeight });
              img.onerror = () => reject(new Error("decode failed"));
              img.src = dataUrl;
            },
          );
          const targetH = 64;
          logo = {
            dataUrl,
            format,
            w: (dims.w / dims.h) * targetH,
            h: targetH,
          };
        } catch {
          logo = null;
        }
      }

      // ---- 2. Centered logo only (nothing under it) ----
      let y = 50;
      if (logo) {
        const logoTargetH = 80;
        const logoW = (logo.w / logo.h) * logoTargetH;
        doc.addImage(
          logo.dataUrl,
          logo.format,
          center - logoW / 2,
          y,
          logoW,
          logoTargetH,
        );
        y += logoTargetH + 22;
      } else {
        doc.setFont(FONT, "bold");
        doc.setFontSize(22);
        doc.setTextColor(47, 90, 71);
        doc.text(data.issuingCompany.brandName, center, y + 16, {
          align: "center",
        });
        y += 38;
      }

      // ---- 3. Two-column block: company (left) | owner (right) ----
      const colGap = 24;
      const colW = (innerW - colGap) / 2;
      const leftX = margin;
      const rightX = margin + colW + colGap;
      const blockTop = y;

      const drawColumn = (
        x: number,
        title: string,
        lines: string[],
        align: "left" | "right" = "left",
      ) => {
        const anchorX = align === "right" ? x + colW : x;
        let cy = blockTop;
        doc.setFont(FONT, "bold");
        doc.setFontSize(11);
        doc.setTextColor(20, 20, 28);
        doc.text(title, anchorX, cy, { align });
        cy += 14;
        doc.setFont(FONT, "normal");
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 110);
        for (const line of lines) {
          if (!line) continue;
          const wrapped = doc.splitTextToSize(line, colW);
          const arr = Array.isArray(wrapped) ? wrapped : [wrapped];
          for (const w of arr) {
            doc.text(w, anchorX, cy, { align });
            cy += 12;
          }
        }
        return cy;
      };

      const leftLines = [
        data.issuingCompany.legalName,
        data.issuingCompany.address,
        data.issuingCompany.email ?? "",
        data.issuingCompany.phone ?? "",
        data.issuingCompany.website?.replace(/^https?:\/\//, "") ?? "",
      ];
      const rightLines = [
        data.recipient?.taxId ?? "",
        data.recipient?.email ?? "",
        data.recipient?.phone ?? "",
        data.recipient?.address ?? "",
      ];

      const leftEnd = drawColumn(
        leftX,
        data.issuingCompany.brandName,
        leftLines,
      );
      const rightEnd = drawColumn(
        rightX,
        data.recipient?.name ?? ownerName,
        rightLines,
        "right",
      );
      y = Math.max(leftEnd, rightEnd) + 16;

      // ---- 4. Property name + Monthly settlement title ----
      doc.setDrawColor(225, 230, 227);
      doc.setLineWidth(0.6);
      doc.line(margin, y, pageWidth - margin, y);
      y += 22;

      doc.setFont(FONT, "bold");
      doc.setFontSize(16);
      doc.setTextColor(20, 20, 28);
      doc.text(`${scopeName} - ${labels.monthlySettlement}`, center, y, {
        align: "center",
      });
      y += 16;
      doc.setFont(FONT, "normal");
      doc.setFontSize(11);
      doc.setTextColor(110, 110, 120);
      doc.text(formatMonthLabel(month, locale), center, y, {
        align: "center",
      });
      y += 22;

      // ---- Common table styling ----
      const baseStyles = {
        font: FONT,
        fontSize: 9,
        cellPadding: 6,
        lineColor: [200, 208, 204] as [number, number, number],
        lineWidth: 0.8,
        valign: "middle" as const,
      };
      const baseFootStyles = {
        font: FONT,
        fillColor: [248, 250, 249] as [number, number, number],
        textColor: [20, 20, 28] as [number, number, number],
        fontStyle: "bold" as const,
      };

      const sectionTitle = (text: string, atY: number) => {
        doc.setFont(FONT, "bold");
        doc.setFontSize(11);
        doc.setTextColor(47, 90, 71);
        doc.text(text, margin, atY);
      };

      // ---- 5. Payments by booking ----
      const right = (content: string) => ({
        content,
        styles: { halign: "right" as const },
      });
      sectionTitle(labels.paymentsByBooking, y);
      autoTable(doc, {
        startY: y + 8,
        margin: { left: margin, right: margin },
        tableWidth: innerW,
        head: [
          [
            labels.stay,
            right(labels.amount),
            right(labels.agency),
            right(labels.portal),
            right(labels.toOwner),
          ],
        ],
        theme: "grid",
        headStyles: {
          fillColor: [243, 247, 244],
          textColor: [47, 90, 71],
          fontStyle: "bold",
        },
        columnStyles: {
          0: { halign: "left" },
          1: { halign: "right" },
          2: { halign: "right" },
          3: { halign: "right" },
          4: { halign: "right" },
        },
        styles: baseStyles,
        body: data.reservations.map((r) => [
          `${formatDate(r.checkIn, locale)} - ${formatDate(r.checkOut, locale)}`,
          fmt(r.totalPrice),
          fmt(r.agencyCommission),
          fmt(r.portalCommission),
          fmt(r.payout),
        ]),
        foot: [
          [
            labels.subtotal,
            right(fmt(data.settlement.totalAmount)),
            right(fmt(data.settlement.totalAgency)),
            right(fmt(data.settlement.totalPortal)),
            right(fmt(data.settlement.totalOwnerPayout)),
          ],
        ],
        footStyles: baseFootStyles,
      });

      let lastY = (doc as unknown as { lastAutoTable: { finalY: number } })
        .lastAutoTable.finalY;

      // ---- 6. Expenses ----
      if (data.expenses.length > 0) {
        sectionTitle(labels.expensesSection, lastY + 26);
        autoTable(doc, {
          startY: lastY + 32,
          margin: { left: margin, right: margin },
          tableWidth: innerW,
          head: [
            [
              labels.date,
              labels.type,
              labels.description,
              right(labels.amount),
            ],
          ],
          theme: "grid",
          headStyles: {
            fillColor: [253, 242, 242],
            textColor: [136, 19, 55],
            fontStyle: "bold",
          },
          columnStyles: {
            0: { halign: "left", cellWidth: 64 },
            1: { halign: "left", cellWidth: 96 },
            2: { halign: "left" },
            3: { halign: "right", cellWidth: 72 },
          },
          styles: baseStyles,
          body: data.expenses.map((e) => [
            formatDate(e.date, locale),
            EXPENSE_TYPE_LABELS[e.type] ?? e.type,
            e.description,
            `- ${fmt(e.amount)}`,
          ]),
          foot: [
            [
              labels.subtotal,
              "",
              "",
              right(`- ${fmt(data.settlement.totalExpenses)}`),
            ],
          ],
          footStyles: {
            ...baseFootStyles,
            fillColor: [253, 242, 242],
            textColor: [136, 19, 55],
          },
        });
        lastY = (doc as unknown as { lastAutoTable: { finalY: number } })
          .lastAutoTable.finalY;
      }

      // ---- 7. Advances (payments on account) ----
      if (data.advances.length > 0) {
        sectionTitle(labels.paymentsOnAccount, lastY + 26);
        autoTable(doc, {
          startY: lastY + 32,
          margin: { left: margin, right: margin },
          tableWidth: innerW,
          head: [[labels.date, labels.concept, right(labels.amount)]],
          theme: "grid",
          headStyles: {
            fillColor: [254, 247, 233],
            textColor: [120, 53, 15],
            fontStyle: "bold",
          },
          columnStyles: {
            0: { halign: "left", cellWidth: 64 },
            1: { halign: "left" },
            2: { halign: "right", cellWidth: 72 },
          },
          styles: baseStyles,
          body: data.advances.map((a) => [
            formatDate(a.date, locale),
            a.concept,
            `- ${fmt(a.amount)}`,
          ]),
          foot: [
            [
              labels.subtotal,
              "",
              right(`- ${fmt(data.settlement.totalAdvances)}`),
            ],
          ],
          footStyles: {
            ...baseFootStyles,
            fillColor: [254, 247, 233],
            textColor: [120, 53, 15],
          },
        });
        lastY = (doc as unknown as { lastAutoTable: { finalY: number } })
          .lastAutoTable.finalY;
      }

      // ---- 8. Final settlement card ----
      const totalY = lastY + 28;
      const cardH = 64;
      doc.setFillColor(47, 90, 71);
      doc.roundedRect(margin, totalY, innerW, cardH, 10, 10, "F");
      doc.setFont(FONT, "bold");
      doc.setFontSize(8);
      doc.setTextColor(220, 232, 226);
      doc.text(labels.settlementTotal.toUpperCase(), margin + 18, totalY + 22);
      doc.setFont(FONT, "bold");
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.text(
        fmt(data.settlement.settlementTotal),
        pageWidth - margin - 18,
        totalY + 36,
        { align: "right" },
      );
      doc.setFont(FONT, "normal");
      doc.setFontSize(8);
      doc.setTextColor(220, 232, 226);
      doc.text(
        `${labels.totalIncome} ${fmt(data.settlement.totalOwnerPayout)}   ·   ${labels.totalDeductions} ${fmt(-data.settlement.totalDeductions)}`,
        margin + 18,
        totalY + cardH - 14,
      );

      // ---- 9. Footer (page number only) ----
      const totalPages = (
        doc as unknown as { getNumberOfPages: () => number }
      ).getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont(FONT, "normal");
        doc.setTextColor(150, 150, 160);
        doc.text(
          `${data.issuingCompany.brandName} · ${formatMonthLabel(month, locale)}`,
          margin,
          pageHeight - 22,
        );
        doc.text(
          `${i} / ${totalPages}`,
          pageWidth - margin,
          pageHeight - 22,
          { align: "right" },
        );
      }

      const slug = scopeName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      doc.save(`${slug}-${month}.pdf`);
    } finally {
      setBusy(null);
    }
  };

  if (availableMonths.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-[var(--color-border)] bg-white px-6 py-10 text-center text-sm text-[var(--color-muted)]">
        {labels.noMonthsAvailable}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Month picker */}
      <label className="block">
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          {labels.selectMonth}
        </span>
        <div className="relative">
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="h-11 w-full appearance-none rounded-2xl border border-[var(--color-border)] bg-white pl-4 pr-10 text-sm font-semibold text-[var(--color-fg)] shadow-sm transition-colors hover:border-[var(--color-brand)] focus:border-[var(--color-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20"
          >
            {availableMonths.map((mk) => (
              <option key={mk} value={mk}>
                {formatMonthLabel(mk, locale)}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
        </div>
      </label>

      {loading && !data ? (
        <ReportSkeleton />
      ) : data ? (
        <FadeIn delay={0.05}>
          {/* Period summary */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-white p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              {scopeName}
            </div>
            <div className="mt-0.5 text-base font-bold tracking-tight">
              {formatMonthLabel(month, locale)}
            </div>
            <div className="text-[11px] text-[var(--color-muted)]">
              {data.issuingCompany.legalName} →{" "}
              {data.recipient?.name ?? ownerName}
              {data.recipient?.taxId && ` (${data.recipient.taxId})`}
            </div>
          </div>

          {/* Section: Bookings */}
          <Section
            title={labels.paymentsByBooking}
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
                      <th className="px-3 py-2 text-left font-semibold">
                        {labels.stay}
                      </th>
                      <th className="px-3 py-2 text-right font-semibold">
                        {labels.agency}
                      </th>
                      <th className="px-3 py-2 text-right font-semibold">
                        {labels.portal}
                      </th>
                      <th className="px-3 py-2 text-right font-semibold">
                        {labels.toOwner}
                      </th>
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
                        {labels.subtotal}
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

          {data.expenses.length > 0 && (
            <Section
              title={labels.expensesSection}
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
                      <td
                        colSpan={2}
                        className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider"
                      >
                        {labels.subtotal}
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

          {data.advances.length > 0 && (
            <Section
              title={labels.paymentsOnAccount}
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
                      <td
                        colSpan={2}
                        className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider"
                      >
                        {labels.subtotal}
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

          {/* Settlement total summary */}
          <div
            className="mt-5 mb-12 flex items-center justify-between rounded-3xl border border-[var(--color-brand)]/20 px-5 py-4 sm:px-6 sm:py-5"
            style={{
              background:
                "linear-gradient(135deg, #f3f7f4 0%, #e8efe9 60%, #dde7df 100%)",
              boxShadow:
                "0 12px 24px -16px rgba(47,90,71,0.18), 0 3px 10px -6px rgba(47,90,71,0.10)",
            }}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-brand)]">
              {labels.settlementTotal}
            </span>
            <span className="text-2xl font-bold tracking-tight tabular-nums text-[var(--color-foreground)]">
              {fmt(data.settlement.settlementTotal)}
            </span>
          </div>

          {/* Single PDF download */}
          <div className="sticky bottom-0 -mx-5 -mb-5 mt-5 border-t border-[var(--color-border)] bg-white/95 p-4 backdrop-blur-md">
            <button
              onClick={exportPdf}
              disabled={busy !== null}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-semibold text-white shadow transition-all active:scale-[0.99] disabled:opacity-60",
              )}
              style={{
                background:
                  "linear-gradient(135deg, #4f8a6f 0%, #3d6f57 60%, #2f5a47 100%)",
              }}
            >
              {busy === "pdf" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
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
    </div>
  );
}
