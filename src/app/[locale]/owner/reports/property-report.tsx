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
  guest: string;
  payout: string;
  loading: string;
  noData: string;
  pdf: string;
  selectMonth: string;
  noMonthsAvailable: string;
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
  brand,
  labels,
}: {
  propertyId: string;
  scopeName: string;
  scopeCreatedAt: string | null;
  ownerName: string;
  locale: Locale;
  brand: Brand;
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

      // === Header bands: Issuing company (left) + Recipient (right) ===
      const colW = (pageWidth - 64 - 16) / 2;
      const headerY = 50;

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

      const rightX = 32 + colW + 16;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(20, 20, 28);
      doc.text("Recipient", rightX, headerY);
      doc.setFontSize(10);
      doc.text(data.recipient?.name ?? ownerName, rightX, headerY + 18);
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
      doc.text(`Monthly settlement | ${scopeName}`, 44, titleY + 20);

      // === Period meta (no settlement Nº) ===
      autoTable(doc, {
        startY: titleY + 44,
        head: [["Period", "Date", "Currency"]],
        theme: "striped",
        headStyles: { fillColor: [243, 247, 244], textColor: [20, 20, 28] },
        styles: { fontSize: 9 },
        body: [
          [
            formatMonthLabel(month, locale),
            data.settlementDate.slice(0, 10),
            data.currency,
          ],
        ],
      });

      let lastY = (doc as unknown as { lastAutoTable: { finalY: number } })
        .lastAutoTable.finalY;

      // === Payments by booking — no booking number column ===
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(20, 20, 28);
      doc.text("Payments by booking", 32, lastY + 22);

      autoTable(doc, {
        startY: lastY + 30,
        head: [
          [
            "Stay period",
            "Amount",
            "Agency commission",
            "Portal commission",
            "To owner",
          ],
        ],
        theme: "striped",
        headStyles: { fillColor: [243, 247, 244], textColor: [20, 20, 28] },
        styles: { fontSize: 8 },
        body: data.reservations.map((r) => [
          `${formatDate(r.checkIn, locale)} - ${formatDate(r.checkOut, locale)}`,
          fmt(r.totalPrice),
          fmt(r.agencyCommission),
          fmt(r.portalCommission),
          fmt(r.payout),
        ]),
        foot: [
          [
            "Subtotal:",
            fmt(data.settlement.totalAmount),
            fmt(data.settlement.totalAgency),
            fmt(data.settlement.totalPortal),
            fmt(data.settlement.totalOwnerPayout),
          ],
        ],
        footStyles: {
          fillColor: [243, 247, 244],
          textColor: [20, 20, 28],
          fontStyle: "bold",
        },
      });

      lastY = (doc as unknown as { lastAutoTable: { finalY: number } })
        .lastAutoTable.finalY;

      if (data.expenses.length > 0) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("Expenses", 32, lastY + 22);
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
          footStyles: {
            fillColor: [243, 247, 244],
            textColor: [20, 20, 28],
            fontStyle: "bold",
          },
        });
        lastY = (doc as unknown as { lastAutoTable: { finalY: number } })
          .lastAutoTable.finalY;
      }

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
          footStyles: {
            fillColor: [243, 247, 244],
            textColor: [20, 20, 28],
            fontStyle: "bold",
          },
        });
        lastY = (doc as unknown as { lastAutoTable: { finalY: number } })
          .lastAutoTable.finalY;
      }

      // === Settlement total ===
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
      const totalPages = (
        doc as unknown as { getNumberOfPages: () => number }
      ).getNumberOfPages();
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
      doc.save(`${slug}-${month}.pdf`);
    } finally {
      setBusy(null);
    }
  };

  void brand;

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
                      <th className="px-3 py-2 text-right font-semibold">
                        Agency
                      </th>
                      <th className="px-3 py-2 text-right font-semibold">
                        Portal
                      </th>
                      <th className="px-3 py-2 text-right font-semibold">
                        To owner
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
                        Subtotal
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
                      <td
                        colSpan={2}
                        className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider"
                      >
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
                      <td
                        colSpan={2}
                        className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider"
                      >
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
