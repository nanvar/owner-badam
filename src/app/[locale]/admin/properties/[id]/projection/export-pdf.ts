"use client";

import { formatCurrency } from "@/lib/utils";
import { computeScenario, type ProjectionBrand, type ProjectionData } from "./projection-editor";
import type { Locale } from "@/i18n/config";

// Brand palette — keeps the deck visually consistent with Badam.
const BRAND_DARK: [number, number, number] = [47, 90, 71]; // forest
const BRAND: [number, number, number] = [79, 138, 111]; // brand emerald
const BRAND_ACCENT: [number, number, number] = [196, 75, 110]; // rose accent
const INK: [number, number, number] = [30, 35, 40];
const MUTED: [number, number, number] = [110, 116, 122];
const SURFACE_SOFT: [number, number, number] = [243, 247, 244];
const BORDER: [number, number, number] = [217, 224, 220];

function safeFile(name: string) {
  return name.replace(/[^\w\d\-_. ]+/g, "").trim();
}

function splitBullets(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export async function exportProjectionPdf(
  data: ProjectionData,
  brand: ProjectionBrand,
  locale: Locale,
) {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const fmt = (n: number) => formatCurrency(n, "AED", locale);
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
  });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const FONT = "helvetica";

  const drawLogo = (x: number, y: number, maxH = 28) => {
    if (!brand.logoDataUrl) return;
    try {
      const mimeMatch = /^data:([^;]+);base64,/.exec(brand.logoDataUrl);
      const format = /jpeg|jpg/i.test(mimeMatch?.[1] ?? "")
        ? "JPEG"
        : "PNG";
      // Assume ~3:1 aspect for typical wordmarks; jspdf doesn't expose
      // image dims off a data URL without ImageBitmap.
      doc.addImage(
        brand.logoDataUrl,
        format,
        x,
        y,
        maxH * 3,
        maxH,
        undefined,
        "FAST",
      );
    } catch {
      /* ignore — fallback to brand name only */
    }
  };

  const setFill = (rgb: [number, number, number]) =>
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  const setText = (rgb: [number, number, number]) =>
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  const setDraw = (rgb: [number, number, number]) =>
    doc.setDrawColor(rgb[0], rgb[1], rgb[2]);

  const newPage = (drawChrome = true) => {
    if (doc.getNumberOfPages() > 1 || drawChrome === false) {
      if (drawChrome) doc.addPage("a4", "landscape");
    }
    // Top brand bar.
    setFill(BRAND_DARK);
    doc.rect(0, 0, pageW, 6, "F");
    // Footer
    setFill(SURFACE_SOFT);
    doc.rect(0, pageH - 22, pageW, 22, "F");
    setText(MUTED);
    doc.setFont(FONT, "normal");
    doc.setFontSize(8);
    if (brand.email) doc.text(brand.email, margin, pageH - 8);
    if (brand.phone) doc.text(brand.phone, pageW / 2, pageH - 8, { align: "center" });
    doc.text(brand.name, pageW - margin, pageH - 8, { align: "right" });
  };

  // ===== Slide 1 — Hero =====
  newPage(false);
  // Logo top-left
  if (brand.logoDataUrl) drawLogo(margin, 22, 32);
  else {
    setText(INK);
    doc.setFont(FONT, "bold");
    doc.setFontSize(16);
    doc.text(brand.name, margin, 46);
  }
  // Hero title
  setText(INK);
  doc.setFont(FONT, "bold");
  doc.setFontSize(36);
  doc.text("YOU COULD EARN", margin, 130);
  setText(BRAND_ACCENT);
  doc.setFontSize(26);
  const heroLine = `AED ${data.avgMonthlyNet.toLocaleString("en-GB", { maximumFractionDigits: 0 })} NET`;
  doc.text(heroLine, margin, 168);
  setText(INK);
  doc.setFontSize(20);
  doc.text("on average per month for your property", margin, 196);

  // Left meta block: area / building / bedrooms
  const metaY = 260;
  const metaItems: Array<{ label: string; value: string }> = [
    { label: "AREA", value: data.area || "—" },
    { label: "BUILDING", value: data.buildingName || data.propertyName },
    {
      label: "BEDROOMS",
      value:
        data.bedrooms === 1 ? "1 BEDROOM" : `${data.bedrooms} BEDROOMS`,
    },
  ];
  metaItems.forEach((m, i) => {
    const x = margin;
    const y = metaY + i * 48;
    setText(BRAND_ACCENT);
    doc.setFont(FONT, "bold");
    doc.setFontSize(11);
    doc.text(m.label, x, y);
    setDraw(BRAND_ACCENT);
    doc.setLineWidth(0.8);
    doc.line(x, y + 2, x + 60, y + 2);
    setText(INK);
    doc.setFontSize(13);
    doc.text(m.value.toUpperCase(), x, y + 20);
  });

  // Right side: Expected monthly costs panel
  const rightX = pageW / 2 + 20;
  setText(BRAND_ACCENT);
  doc.setFont(FONT, "bold");
  doc.setFontSize(18);
  doc.text("EXPECTED MONTHLY COSTS", rightX, 130);
  setFill(SURFACE_SOFT);
  doc.roundedRect(rightX, 150, pageW - margin - rightX, 220, 14, 14, "F");

  const costs = [
    {
      label: "Du (Internet)",
      value: `${data.duMonthly.toLocaleString("en-GB")} AED`,
      sub: "/ month",
    },
    {
      label: "DEWA + Chiller",
      value: `${data.dewaChillerMonthly.toLocaleString("en-GB")} AED`,
      sub: "/ month",
    },
    {
      label: "Property Insurance",
      value: `${data.propertyInsuranceYearly.toLocaleString("en-GB")} AED`,
      sub: "/ year",
    },
    {
      label: "Maintenance",
      value: `${data.maintenanceMonthly.toLocaleString("en-GB")} AED`,
      sub: "/ month",
    },
    {
      label: "DTCM Unit Permit",
      value: `${data.dtcmPermitYearly.toLocaleString("en-GB")} AED`,
      sub: "/ year",
    },
  ];
  costs.forEach((c, i) => {
    const baseY = 175 + i * 38;
    setText(MUTED);
    doc.setFont(FONT, "normal");
    doc.setFontSize(10);
    doc.text(c.label, rightX + 18, baseY);
    setText(BRAND_ACCENT);
    doc.setFont(FONT, "bold");
    doc.setFontSize(14);
    const valX = pageW - margin - 16;
    doc.text(c.value, valX, baseY, { align: "right" });
    setText(MUTED);
    doc.setFont(FONT, "normal");
    doc.setFontSize(8);
    doc.text(c.sub, valX, baseY + 11, { align: "right" });
  });

  // ===== Slide 2 — Services =====
  newPage();
  if (brand.logoDataUrl) drawLogo(margin, 22, 28);
  setText(INK);
  doc.setFont(FONT, "bold");
  doc.setFontSize(28);
  doc.text("OUR SERVICES", margin, 92);
  setText(INK);
  doc.setFontSize(13);
  doc.text("We charge a ", margin, 120);
  setText(BRAND_ACCENT);
  doc.setFont(FONT, "bold");
  doc.text(
    `${data.managementFeePct}% management fee + VAT`,
    margin + 70,
    120,
  );
  setText(INK);
  doc.setFont(FONT, "normal");
  doc.text(" on the revenue generated for your property.", margin + 218, 120);

  const colW = (pageW - margin * 2 - 40) / 3;
  const cols = [
    { title: "LISTING MANAGEMENT", bullets: splitBullets(data.listingMgmtBullets) },
    { title: "GUEST MANAGEMENT", bullets: splitBullets(data.guestMgmtBullets) },
    { title: "PROPERTY MANAGEMENT", bullets: splitBullets(data.propertyMgmtBullets) },
  ];
  cols.forEach((c, i) => {
    const x = margin + i * (colW + 20);
    const headerY = 160;
    // Header card
    setFill(BRAND_ACCENT);
    doc.roundedRect(x, headerY, colW, 30, 10, 10, "F");
    doc.setFont(FONT, "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(c.title, x + 16, headerY + 19);
    // Body card
    const bodyY = headerY + 40;
    const bodyH = pageH - bodyY - 40;
    setFill(SURFACE_SOFT);
    doc.roundedRect(x, bodyY, colW, bodyH, 10, 10, "F");
    setText(INK);
    doc.setFont(FONT, "normal");
    doc.setFontSize(10);
    c.bullets.forEach((b, idx) => {
      const by = bodyY + 22 + idx * 18;
      setFill(BRAND_ACCENT);
      doc.circle(x + 18, by - 3, 1.6, "F");
      setText(INK);
      doc.text(b, x + 26, by);
    });
  });

  // ===== Slide 3 — About =====
  newPage();
  if (brand.logoDataUrl) drawLogo(margin, 22, 28);
  setText(INK);
  doc.setFont(FONT, "bold");
  doc.setFontSize(32);
  doc.text("ABOUT US", margin, 100);

  // About paragraph — wrap to ~half the page.
  const aboutW = pageW - margin * 2 - 280;
  setText(INK);
  doc.setFont(FONT, "normal");
  doc.setFontSize(13);
  const lines = doc.splitTextToSize(data.aboutText, aboutW);
  doc.text(lines, margin, 140);

  // Right column: reasons list
  const reasons: Array<{ title: string; body: string }> = [
    { title: "MORE REVENUE", body: "10–15% more income than long-term contracts." },
    { title: "NO COMMITMENT", body: "No long-term commitment with tenants." },
    { title: "FLEXIBILITY", body: "Sell your property whenever you want." },
    { title: "EASY MANAGEMENT", body: "Hassle-free management end-to-end." },
    { title: "FREEDOM TO USE", body: "Block your own dates whenever you need." },
    { title: "LESS FLUCTUATION", body: "Optimise revenue based on seasonality." },
    { title: "CAPITAL GAINS", body: "Higher sales price than long-term rentals." },
  ];
  const rcolX = pageW - margin - 260;
  reasons.forEach((r, i) => {
    const y = 130 + i * 38;
    setFill(BRAND_ACCENT);
    doc.circle(rcolX, y - 4, 2.5, "F");
    setText(BRAND_ACCENT);
    doc.setFont(FONT, "bold");
    doc.setFontSize(11);
    doc.text(r.title, rcolX + 10, y);
    setText(INK);
    doc.setFont(FONT, "normal");
    doc.setFontSize(9);
    doc.text(r.body, rcolX + 10, y + 12);
  });

  // ===== Slide 4 — Financial breakdown =====
  newPage();
  if (brand.logoDataUrl) drawLogo(margin, 22, 28);
  setText(INK);
  doc.setFont(FONT, "bold");
  doc.setFontSize(28);
  doc.text("FINANCIAL BREAKDOWN", margin, 100);

  const p = computeScenario(data.pessimisticGross, data);
  const r = computeScenario(data.realisticGross, data);
  const o = computeScenario(data.optimisticGross, data);
  const utilities = p.utilities; // identical across scenarios
  // Split utilities back into the rows the original deck shows.
  const duYear = data.duMonthly * 12;
  const dewaYear = data.dewaChillerMonthly * 12;
  const maintenanceYear = data.maintenanceMonthly * 12;

  autoTable(doc, {
    startY: 130,
    margin: { left: margin, right: margin },
    head: [["", "Pessimistic", "Realistic", "Optimistic"]],
    body: [
      [
        "Occupancy rate",
        `${data.pessimisticOccupancy}%`,
        `${data.realisticOccupancy}%`,
        `${data.optimisticOccupancy}%`,
      ],
      [
        { content: "Gross annual revenue", styles: { fontStyle: "bold" } },
        fmt(data.pessimisticGross),
        fmt(data.realisticGross),
        fmt(data.optimisticGross),
      ],
      ["Portal fees (Booking, Airbnb…)", fmt(p.portal), fmt(r.portal), fmt(o.portal)],
      ["Du (Internet)", fmt(duYear), fmt(duYear), fmt(duYear)],
      ["DEWA + Chiller", fmt(dewaYear), fmt(dewaYear), fmt(dewaYear)],
      [
        "Property insurance",
        fmt(data.propertyInsuranceYearly),
        fmt(data.propertyInsuranceYearly),
        fmt(data.propertyInsuranceYearly),
      ],
      [
        "DTCM registration",
        fmt(data.dtcmPermitYearly),
        fmt(data.dtcmPermitYearly),
        fmt(data.dtcmPermitYearly),
      ],
      [
        "Maintenance and wear & tear",
        fmt(maintenanceYear),
        fmt(maintenanceYear),
        fmt(maintenanceYear),
      ],
      ["Management fee", fmt(p.managementFee), fmt(r.managementFee), fmt(o.managementFee)],
      ["VAT", fmt(p.vat), fmt(r.vat), fmt(o.vat)],
      [
        { content: "Total operating expenses", styles: { fontStyle: "bold" } },
        { content: fmt(p.totalExpenses), styles: { fontStyle: "bold" } },
        { content: fmt(r.totalExpenses), styles: { fontStyle: "bold" } },
        { content: fmt(o.totalExpenses), styles: { fontStyle: "bold" } },
      ],
    ],
    foot: [
      [
        { content: "Net annual income", styles: { fontStyle: "bold" } },
        { content: fmt(p.net), styles: { fontStyle: "bold" } },
        { content: fmt(r.net), styles: { fontStyle: "bold" } },
        { content: fmt(o.net), styles: { fontStyle: "bold" } },
      ],
    ],
    theme: "grid",
    styles: {
      font: FONT,
      fontSize: 10,
      cellPadding: 6,
      lineColor: BORDER,
      lineWidth: 0.8,
      textColor: INK,
    },
    headStyles: {
      fillColor: BRAND_DARK,
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
    },
    bodyStyles: { halign: "right" },
    columnStyles: {
      0: { halign: "left", fontStyle: "normal" },
    },
    footStyles: {
      fillColor: BRAND,
      textColor: 255,
      halign: "right",
      fontStyle: "bold",
    },
  });

  // Suppress unused-var warning for `utilities`: we display the split rows.
  void utilities;

  const safeName = safeFile(
    `${data.buildingName || data.propertyName}-projection`,
  );
  doc.save(`${safeName}.pdf`);
}
