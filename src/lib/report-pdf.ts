// Server-side PDF generator for owner reports. Mirrors the layout the
// browser bundle produces in `components/report-pdf-button.tsx`. Caches
// the DejaVu Sans font (Cyrillic-capable) at module scope so we only
// fetch it once per process — subsequent requests are cheap.

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const FONT_REGULAR_URL =
  "https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.0/ttf/DejaVuSans.ttf";
const FONT_BOLD_URL =
  "https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.0/ttf/DejaVuSans-Bold.ttf";

let cachedFonts: { regular: string; bold: string } | null | undefined;

async function loadCyrillicFonts() {
  if (cachedFonts !== undefined) return cachedFonts;
  try {
    const [regular, bold] = await Promise.all([
      fetchAsBase64(FONT_REGULAR_URL),
      fetchAsBase64(FONT_BOLD_URL),
    ]);
    cachedFonts = { regular, bold };
  } catch {
    cachedFonts = null;
  }
  return cachedFonts;
}

async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`font fetch failed (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.toString("base64");
}

export type ReportPdfInput = {
  name: string;
  notes: string | null;
  createdAt: string;
  property: { name: string };
  owner: {
    name: string;
    email: string;
    phone: string | null;
    taxId: string | null;
    address: string | null;
  };
  reservations: Array<{
    checkIn: string;
    checkOut: string;
    nights: number;
    guestName: string | null;
    totalPrice: number;
    payout: number;
    currency: string;
  }>;
  expenses: Array<{
    date: string;
    type: string;
    description: string;
    amount: number;
  }>;
  totals: { income: number; expenses: number; net: number };
  brand: {
    name: string;
    legalName: string;
    logoDataUrl: string | null;
    address: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
  };
};

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function formatCurrency(n: number, currency = "AED") {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

export async function buildReportPdf(data: ReportPdfInput): Promise<Buffer> {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  const innerW = pageWidth - margin * 2;
  const center = pageWidth / 2;

  const fonts = await loadCyrillicFonts();
  let FONT = "helvetica";
  if (fonts) {
    doc.addFileToVFS("DejaVuSans.ttf", fonts.regular);
    doc.addFont("DejaVuSans.ttf", "DejaVuSans", "normal");
    doc.addFileToVFS("DejaVuSans-Bold.ttf", fonts.bold);
    doc.addFont("DejaVuSans-Bold.ttf", "DejaVuSans", "bold");
    FONT = "DejaVuSans";
  }

  // Brand header
  let y = 50;
  if (data.brand.logoDataUrl) {
    try {
      // jsPDF's Node addImage accepts a data URL and figures out dimensions
      // from the embedded width/height — same call as in the browser.
      const targetH = 64;
      const aspect = 3; // fallback if we can't read the image dims
      const w = targetH * aspect;
      doc.addImage(
        data.brand.logoDataUrl,
        "PNG",
        center - w / 2,
        y,
        w,
        targetH,
      );
      y += targetH + 18;
    } catch {
      doc.setFont(FONT, "bold");
      doc.setFontSize(22);
      doc.setTextColor(47, 90, 71);
      doc.text(data.brand.name, center, y + 16, { align: "center" });
      y += 38;
    }
  } else {
    doc.setFont(FONT, "bold");
    doc.setFontSize(22);
    doc.setTextColor(47, 90, 71);
    doc.text(data.brand.name, center, y + 16, { align: "center" });
    y += 38;
  }

  // Two-column block: company on left, recipient on right
  const colGap = 24;
  const colW = (innerW - colGap) / 2;
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
    for (const line of lines.filter(Boolean)) {
      const wrapped = doc.splitTextToSize(line, colW);
      const arr = Array.isArray(wrapped) ? wrapped : [wrapped];
      for (const w of arr) {
        doc.text(w, anchorX, cy, { align });
        cy += 12;
      }
    }
    return cy;
  };
  const leftEnd = drawColumn(
    margin,
    data.brand.legalName || data.brand.name,
    [
      data.brand.address ?? "",
      data.brand.email ?? "",
      data.brand.phone ?? "",
      data.brand.website?.replace(/^https?:\/\//, "") ?? "",
    ],
  );
  const rightEnd = drawColumn(
    margin + colW + colGap,
    data.owner.name,
    [
      data.owner.taxId ?? "",
      data.owner.email,
      data.owner.phone ?? "",
      data.owner.address ?? "",
    ],
    "right",
  );
  y = Math.max(leftEnd, rightEnd) + 16;

  // Title divider
  doc.setDrawColor(225, 230, 227);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageWidth - margin, y);
  y += 22;

  doc.setFont(FONT, "bold");
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 28);
  doc.text(`${data.property.name} — ${data.name}`, center, y, {
    align: "center",
  });
  y += 16;
  doc.setFont(FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(110, 110, 120);
  doc.text(formatDate(data.createdAt), center, y, { align: "center" });
  y += 18;

  // Tables
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
  const right = (content: string) => ({
    content,
    styles: { halign: "right" as const },
  });

  sectionTitle("Reservations", y);
  autoTable(doc, {
    startY: y + 8,
    margin: { left: margin, right: margin },
    tableWidth: innerW,
    head: [
      ["Guest", "Stay", right("Nights"), right("Total"), right("Payout")],
    ],
    theme: "grid",
    headStyles: {
      fillColor: [243, 247, 244],
      textColor: [47, 90, 71],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { halign: "left" },
      1: { halign: "left" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
    styles: baseStyles,
    body: data.reservations.map((r) => [
      r.guestName ?? "—",
      `${formatDate(r.checkIn)} → ${formatDate(r.checkOut)}`,
      String(r.nights),
      formatCurrency(r.totalPrice, r.currency),
      formatCurrency(r.payout, r.currency),
    ]),
    foot: [
      [
        { content: "Total income", colSpan: 4, styles: baseFootStyles },
        {
          content: formatCurrency(data.totals.income),
          styles: { ...baseFootStyles, halign: "right" },
        },
      ],
    ],
  });
  // @ts-expect-error jspdf-autotable extends jsPDF internals at runtime
  y = (doc.lastAutoTable?.finalY ?? y + 60) + 24;

  if (data.expenses.length > 0) {
    sectionTitle("Expenses", y);
    autoTable(doc, {
      startY: y + 8,
      margin: { left: margin, right: margin },
      tableWidth: innerW,
      head: [["Date", "Type", "Description", right("Amount")]],
      theme: "grid",
      headStyles: {
        fillColor: [243, 247, 244],
        textColor: [47, 90, 71],
        fontStyle: "bold",
      },
      columnStyles: {
        0: { halign: "left" },
        1: { halign: "left" },
        2: { halign: "left" },
        3: { halign: "right" },
      },
      styles: baseStyles,
      body: data.expenses.map((e) => [
        formatDate(e.date),
        e.type,
        e.description,
        formatCurrency(e.amount),
      ]),
      foot: [
        [
          { content: "Total expenses", colSpan: 3, styles: baseFootStyles },
          {
            content: formatCurrency(data.totals.expenses),
            styles: { ...baseFootStyles, halign: "right" },
          },
        ],
      ],
    });
    // @ts-expect-error jspdf-autotable extends jsPDF internals
    y = (doc.lastAutoTable?.finalY ?? y + 60) + 24;
  }

  // Net payout box
  doc.setDrawColor(47, 90, 71);
  doc.setLineWidth(1);
  doc.setFillColor(243, 247, 244);
  doc.roundedRect(margin, y, innerW, 50, 6, 6, "FD");
  doc.setFont(FONT, "bold");
  doc.setFontSize(12);
  doc.setTextColor(47, 90, 71);
  doc.text("Net payout to owner", margin + 16, y + 30);
  doc.setFontSize(16);
  doc.text(
    formatCurrency(data.totals.net),
    pageWidth - margin - 16,
    y + 32,
    { align: "right" },
  );

  const ab = doc.output("arraybuffer");
  return Buffer.from(ab);
}
