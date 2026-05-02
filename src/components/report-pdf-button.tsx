"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Locale } from "@/i18n/config";

// jsPDF's built-in helvetica only covers Latin glyphs. DejaVu Sans is the
// most reliable Cyrillic-capable TTF for jsPDF's TrueType loader. Loaded
// lazily from jsDelivr the first time a user clicks Download.
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

export type ReportPdfData = {
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
    id: string;
    checkIn: string;
    checkOut: string;
    nights: number;
    guestName: string | null;
    totalPrice: number;
    payout: number;
    currency: string;
  }>;
  expenses: Array<{
    id: string;
    date: string;
    type: string;
    description: string;
    amount: number;
  }>;
  totals: {
    income: number;
    expenses: number;
    net: number;
  };
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

export function ReportPdfButton({
  data,
  locale,
}: {
  data: ReportPdfData;
  locale: Locale;
}) {
  const [busy, setBusy] = useState(false);
  const fmt = (n: number) => formatCurrency(n, "AED", locale);

  const onClick = async () => {
    setBusy(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
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

      // Brand header: centered logo if present, else legal name as title.
      let y = 50;
      if (data.brand.logoDataUrl) {
        try {
          const dataUrl = data.brand.logoDataUrl;
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
          const logoW = (dims.w / dims.h) * targetH;
          doc.addImage(dataUrl, format, center - logoW / 2, y, logoW, targetH);
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

      // Two-column block: company on left, recipient on right.
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
      const leftEnd = drawColumn(leftX, data.brand.legalName || data.brand.name, [
        data.brand.address ?? "",
        data.brand.email ?? "",
        data.brand.phone ?? "",
        data.brand.website?.replace(/^https?:\/\//, "") ?? "",
      ]);
      const rightEnd = drawColumn(
        rightX,
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

      // Title line: property + report name + created date.
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
      doc.text(formatDate(data.createdAt, locale), center, y, {
        align: "center",
      });
      y += 18;

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

      // Reservations
      sectionTitle("Reservations", y);
      autoTable(doc, {
        startY: y + 8,
        margin: { left: margin, right: margin },
        tableWidth: innerW,
        head: [
          [
            "Guest",
            "Stay",
            right("Nights"),
            right("Total"),
            right("Payout"),
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
          1: { halign: "left" },
          2: { halign: "right" },
          3: { halign: "right" },
          4: { halign: "right" },
        },
        styles: baseStyles,
        body: data.reservations.map((r) => [
          r.guestName ?? "—",
          `${formatDate(r.checkIn, locale)} → ${formatDate(r.checkOut, locale)}`,
          String(r.nights),
          formatCurrency(r.totalPrice, r.currency, locale),
          formatCurrency(r.payout, r.currency, locale),
        ]),
        foot: [
          [
            { content: "Total income", colSpan: 4, styles: baseFootStyles },
            { content: fmt(data.totals.income), styles: { ...baseFootStyles, halign: "right" } },
          ],
        ],
      });

      // @ts-expect-error jspdf-autotable extends jsPDF internals
      y = (doc.lastAutoTable?.finalY ?? y + 60) + 24;

      // Expenses
      if (data.expenses.length > 0) {
        sectionTitle("Expenses", y);
        autoTable(doc, {
          startY: y + 8,
          margin: { left: margin, right: margin },
          tableWidth: innerW,
          head: [
            ["Date", "Type", "Description", right("Amount")],
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
            2: { halign: "left" },
            3: { halign: "right" },
          },
          styles: baseStyles,
          body: data.expenses.map((e) => [
            formatDate(e.date, locale),
            e.type,
            e.description,
            formatCurrency(e.amount, "AED", locale),
          ]),
          foot: [
            [
              { content: "Total expenses", colSpan: 3, styles: baseFootStyles },
              { content: fmt(data.totals.expenses), styles: { ...baseFootStyles, halign: "right" } },
            ],
          ],
        });
        // @ts-expect-error jspdf-autotable extends jsPDF internals
        y = (doc.lastAutoTable?.finalY ?? y + 60) + 24;
      }

      // Net payout summary box.
      doc.setDrawColor(47, 90, 71);
      doc.setLineWidth(1);
      doc.setFillColor(243, 247, 244);
      doc.roundedRect(margin, y, innerW, 50, 6, 6, "FD");
      doc.setFont(FONT, "bold");
      doc.setFontSize(12);
      doc.setTextColor(47, 90, 71);
      doc.text("Net payout to owner", margin + 16, y + 30);
      doc.setFontSize(16);
      doc.text(fmt(data.totals.net), pageWidth - margin - 16, y + 32, {
        align: "right",
      });

      const safeName = `${data.property.name}-${data.name}`
        .replace(/[^\w\d\-_. ]+/g, "")
        .trim();
      doc.save(`${safeName}.pdf`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button onClick={onClick} loading={busy} variant="secondary">
      <Download className="h-4 w-4" />
      Download PDF
    </Button>
  );
}
