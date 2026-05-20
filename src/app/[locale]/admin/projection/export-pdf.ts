"use client";

import { formatCurrency } from "@/lib/utils";
import {
  computeScenario,
  type ProjectionBrand,
  type ProjectionData,
} from "./projection-editor";
import {
  ABOUT_SVG,
  loadBuildingImageDataUrl,
  loadBuildingImageSize,
  svgToPng,
} from "./illustration";
import type { Locale } from "@/i18n/config";

// Palette tuned to the reference deck — gray frame chrome, slate ink,
// rose accent. Kept here so PDF + PPTX render in the same colours.
const FRAME: [number, number, number] = [45, 45, 45]; // near-black border
const INK: [number, number, number] = [60, 60, 60]; // dark slate
const ACCENT: [number, number, number] = [183, 63, 102]; // rose
const ACCENT_SOFT: [number, number, number] = [232, 215, 222];
const MUTED: [number, number, number] = [110, 116, 122];
const CARD_GRAY: [number, number, number] = [184, 190, 188];
const SOFT: [number, number, number] = [243, 247, 244];
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
  const FONT = "helvetica";

  // Layout constants — content lives inside the outer frame.
  const FRAME_INSET = 18;
  const FRAME_W = 5;
  const innerX = FRAME_INSET + 12;
  const innerY = FRAME_INSET + 12;
  const innerW = pageW - 2 * (FRAME_INSET + 12);
  const innerH = pageH - 2 * (FRAME_INSET + 12);

  const setFill = (rgb: [number, number, number]) =>
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  const setText = (rgb: [number, number, number]) =>
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  const setDraw = (rgb: [number, number, number]) =>
    doc.setDrawColor(rgb[0], rgb[1], rgb[2]);

  // Outer rounded border drawn on every slide — mirrors the deck's
  // signature "framed card" look.
  const drawFrame = () => {
    setDraw(FRAME);
    doc.setLineWidth(FRAME_W);
    doc.roundedRect(
      FRAME_INSET,
      FRAME_INSET,
      pageW - 2 * FRAME_INSET,
      pageH - 2 * FRAME_INSET,
      8,
      8,
      "S",
    );
  };

  const drawLogo = (x: number, y: number, maxH = 30) => {
    if (!brand.logoDataUrl) return;
    try {
      const mimeMatch = /^data:([^;]+);base64,/.exec(brand.logoDataUrl);
      const format = /jpeg|jpg/i.test(mimeMatch?.[1] ?? "") ? "JPEG" : "PNG";
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
      /* fall back to brand name */
    }
  };

  const newPage = () => {
    doc.addPage("a4", "landscape");
    drawFrame();
  };

  // ===== Slide 1 — Hero =====
  drawFrame();
  // Top-left logo
  if (brand.logoDataUrl) drawLogo(innerX, innerY, 30);
  else {
    setText(INK);
    doc.setFont(FONT, "bold");
    doc.setFontSize(16);
    doc.text(brand.name, innerX, innerY + 22);
  }

  // Left column — headline
  const leftX = innerX + 6;
  const headlineY = innerY + 110;

  setText(INK);
  doc.setFont(FONT, "bold");
  doc.setFontSize(34);
  doc.text("YOU COULD EARN", leftX, headlineY);

  // Big rose accent line — "AED X NET" + neutral continuation.
  doc.setFontSize(22);
  setText(ACCENT);
  const heroAed = `AED ${data.avgMonthlyNet.toLocaleString("en-GB", { maximumFractionDigits: 0 })} NET`;
  doc.text(heroAed, leftX, headlineY + 34);
  const aedW = doc.getTextWidth(heroAed);
  setText(INK);
  doc.text(" ON AVERAGE PER", leftX + aedW, headlineY + 34);
  doc.text("MONTH FOR ", leftX, headlineY + 60);
  setText(ACCENT);
  doc.text("YOUR PROPERTY", leftX + doc.getTextWidth("MONTH FOR "), headlineY + 60);

  // Meta rows — each: small vector icon in a soft circle, then a rose
  // underlined label, then the value beneath. Icons are drawn with
  // jsPDF primitives because the default Helvetica font has no
  // pictogram glyphs (Unicode shapes render as garbage).
  const drawMetaIcon = (kind: "pin" | "building" | "bed", cx: number, cy: number) => {
    setFill(INK);
    if (kind === "pin") {
      // Map pin: filled teardrop with a white inner hole.
      doc.circle(cx, cy - 3, 5, "F");
      doc.triangle(cx - 4, cy, cx + 4, cy, cx, cy + 7, "F");
      setFill([255, 255, 255]);
      doc.circle(cx, cy - 3, 1.8, "F");
    } else if (kind === "building") {
      // Filled building body with a 3×3 grid of white windows.
      doc.rect(cx - 7, cy - 7, 14, 14, "F");
      setFill([255, 255, 255]);
      const ws = 2.4;
      const gap = 1.4;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          doc.rect(
            cx - 5.6 + c * (ws + gap),
            cy - 5.4 + r * (ws + gap),
            ws,
            ws,
            "F",
          );
        }
      }
    } else {
      // Bed: headboard on the left, mattress slab, base line.
      doc.rect(cx - 8, cy - 5, 3, 9, "F");
      doc.rect(cx - 5, cy + 1, 13, 3, "F");
      setDraw(INK);
      doc.setLineWidth(1.4);
      doc.line(cx - 8, cy + 5, cx + 8, cy + 5);
    }
  };

  const metaRows: Array<{
    label: string;
    value: string;
    icon: "pin" | "building" | "bed";
  }> = [
    {
      label: "AREA",
      value: (data.area || "—").toUpperCase(),
      icon: "pin",
    },
    {
      label: "BUILDING",
      value: (data.buildingName || data.propertyName).toUpperCase(),
      icon: "building",
    },
    {
      label: "BEDROOMS",
      value:
        data.bedrooms === 1 ? "1 BEDROOM" : `${data.bedrooms} BEDROOMS`,
      icon: "bed",
    },
  ];
  metaRows.forEach((m, i) => {
    const y = innerY + 240 + i * 70;
    // Icon disc
    setDraw(INK);
    doc.setLineWidth(0.8);
    setFill([255, 255, 255]);
    doc.circle(leftX + 14, y, 16, "FD");
    drawMetaIcon(m.icon, leftX + 14, y);
    // Label
    setText(ACCENT);
    doc.setFontSize(16);
    doc.setFont(FONT, "bold");
    doc.text(m.label, leftX + 48, y - 4);
    setDraw(ACCENT);
    doc.setLineWidth(1.4);
    const labelW = doc.getTextWidth(m.label);
    doc.line(leftX + 48, y + 2, leftX + 48 + labelW + 8, y + 2);
    // Value
    setText(INK);
    doc.setFont(FONT, "bold");
    doc.setFontSize(13);
    doc.text(m.value, leftX + 48, y + 22);
  });

  // Right column — clean layout: title, centered building hero (no
  // background panel, no leader lines), and a tidy cost list below.
  const rightX = pageW / 2 + 30;
  const rightColW = pageW - rightX - FRAME_INSET - 12;

  setText(INK);
  doc.setFont(FONT, "bold");
  doc.setFontSize(22);
  doc.text("EXPECTED MONTHLY", rightX, headlineY);
  setText(ACCENT);
  doc.text("COSTS", rightX + doc.getTextWidth("EXPECTED MONTHLY") + 8, headlineY);

  // Hero building image — centered, no background, preserves aspect.
  const buildingPng = await loadBuildingImageDataUrl();
  const buildingNat = await loadBuildingImageSize(buildingPng);
  const natRatio = buildingNat.width / buildingNat.height;
  const heroMaxW = rightColW - 40;
  const heroMaxH = 200;
  let illW = heroMaxW;
  let illH = illW / natRatio;
  if (illH > heroMaxH) {
    illH = heroMaxH;
    illW = illH * natRatio;
  }
  const illX = rightX + (rightColW - illW) / 2;
  const illY = headlineY + 18;
  doc.addImage(buildingPng, "PNG", illX, illY, illW, illH, undefined, "FAST");

  // Cost list — clean rows, no card chrome. Rose dot + label on the
  // left, big rose value + small unit right-aligned. Thin rose-tinted
  // divider between rows.
  const costs: Array<{ label: string; value: string; unit: string }> = [
    {
      label: "Du (Internet)",
      value: `${data.duMonthly.toLocaleString("en-GB")} AED`,
      unit: "/ month",
    },
    {
      label: "DEWA + Chiller",
      value: `${data.dewaChillerMonthly.toLocaleString("en-GB")} AED`,
      unit: "/ month",
    },
    {
      label: "Property Insurance",
      value: `${data.propertyInsuranceYearly.toLocaleString("en-GB")} AED`,
      unit: "/ year",
    },
    {
      label: "Maintenance",
      value: `${data.maintenanceMonthly.toLocaleString("en-GB")} AED`,
      unit: "/ month",
    },
    {
      label: "DTCM Unit Permit",
      value: `${data.dtcmPermitYearly.toLocaleString("en-GB")} AED`,
      unit: "/ year",
    },
  ];
  const listX = rightX + 4;
  const listW = rightColW - 8;
  const listTop = illY + illH + 14;
  const listBottom = innerY + innerH - 6;
  const rowH = (listBottom - listTop) / costs.length;
  costs.forEach((c, i) => {
    const rowTop = listTop + i * rowH;
    const rowMid = rowTop + rowH / 2;
    // Rose dot
    setFill(ACCENT);
    doc.circle(listX + 6, rowMid, 2.6, "F");
    // Label
    setText(INK);
    doc.setFont(FONT, "normal");
    doc.setFontSize(11);
    doc.text(c.label, listX + 18, rowMid + 4);
    // Value
    setText(ACCENT);
    doc.setFont(FONT, "bold");
    doc.setFontSize(15);
    const valX = listX + listW - 4;
    doc.text(c.value, valX, rowMid + 1, { align: "right" });
    // Unit
    setText(MUTED);
    doc.setFont(FONT, "normal");
    doc.setFontSize(8);
    doc.text(c.unit, valX, rowMid + 12, { align: "right" });
    // Divider between rows (skip after last)
    if (i < costs.length - 1) {
      setDraw(ACCENT_SOFT);
      doc.setLineWidth(0.4);
      doc.line(listX + 18, rowTop + rowH, listX + listW - 4, rowTop + rowH);
    }
  });

  // ===== Slide 2 — Services =====
  newPage();
  if (brand.logoDataUrl) drawLogo(innerX, innerY, 28);

  setText(INK);
  doc.setFont(FONT, "bold");
  doc.setFontSize(36);
  doc.text("OUR SERVICES", innerX + 6, innerY + 90);

  // Subline with rose accent on the percentage.
  setText(INK);
  doc.setFontSize(14);
  doc.text("WE CHARGE A ", innerX + 6, innerY + 130);
  let cursorX = innerX + 6 + doc.getTextWidth("WE CHARGE A ");
  setText(ACCENT);
  doc.setFont(FONT, "bold");
  const feeText = `${data.managementFeePct}% MANAGEMENT FEE + VAT `;
  doc.text(feeText, cursorX, innerY + 130);
  cursorX += doc.getTextWidth(feeText);
  setText(INK);
  doc.setFont(FONT, "bold");
  doc.text("ON THE REVENUE", cursorX, innerY + 130);
  doc.text("GENERATED FOR YOUR PROPERTY.", innerX + 6, innerY + 152);

  const colW = (innerW - 40) / 3;
  const colY = innerY + 195;
  const cards = [
    { title: "LISTING MANAGEMENT", bullets: splitBullets(data.listingMgmtBullets) },
    { title: "GUEST MANAGEMENT", bullets: splitBullets(data.guestMgmtBullets) },
    { title: "PROPERTY MANAGEMENT", bullets: splitBullets(data.propertyMgmtBullets) },
  ];
  cards.forEach((c, i) => {
    const x = innerX + 6 + i * (colW + 20);
    // Pink header pill
    setFill(ACCENT);
    doc.roundedRect(x, colY, colW, 34, 8, 8, "F");
    doc.setFont(FONT, "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(c.title, x + 16, colY + 22);
    // Gray body card
    const bodyY = colY + 44;
    const bodyH = innerH - (bodyY - innerY) - 14;
    setFill(CARD_GRAY);
    doc.roundedRect(x, bodyY, colW, bodyH, 8, 8, "F");
    setText([255, 255, 255]);
    doc.setFont(FONT, "bold");
    doc.setFontSize(11);
    c.bullets.forEach((b, idx) => {
      const by = bodyY + 28 + idx * 22;
      doc.setFontSize(11);
      // Solid dot
      doc.setFillColor(255, 255, 255);
      doc.circle(x + 22, by - 4, 1.8, "F");
      doc.setTextColor(40, 40, 50);
      doc.text(b, x + 32, by);
    });
  });

  // ===== Slide 3 — About (3-column layout) =====
  // Left: illustration. Middle: intro paragraph + reasons. Right:
  // contact info stacked.
  newPage();
  if (brand.logoDataUrl) drawLogo(innerX, innerY, 28);

  setText(INK);
  doc.setFont(FONT, "bold");
  doc.setFontSize(36);
  doc.text("ABOUT US", innerX + 6, innerY + 90);

  // Column geometry — three vertical bands inside the inner frame.
  const colLeftX = innerX + 6;
  const colLeftW = 220;
  const colMidX = innerX + 250;
  const colMidW = 320;
  const colRightX = innerX + 590;
  const colRightW = innerW - (colRightX - innerX) - 6;

  // --- Left column: illustration ---
  const aboutIllSize = Math.min(colLeftW, 230);
  const aboutIllX = colLeftX + (colLeftW - aboutIllSize) / 2;
  const aboutIllY = innerY + 130;
  const aboutPng = await svgToPng(ABOUT_SVG, aboutIllSize, aboutIllSize);
  doc.addImage(
    aboutPng,
    "PNG",
    aboutIllX,
    aboutIllY,
    aboutIllSize,
    aboutIllSize,
    undefined,
    "FAST",
  );

  // --- Middle column: intro paragraph + reasons list ---
  // Intro is rendered with a hard line cap so a long aboutText cannot
  // bleed into the reasons list. Reasons row height + start Y are then
  // tuned to whatever vertical space is left in the column.
  const intro = data.aboutText || "";
  const introFontSize = 13;
  const introLineH = 16;
  const introMaxLines = 4;
  setText(INK);
  doc.setFont(FONT, "bold");
  doc.setFontSize(introFontSize);
  const wrappedIntro: string[] = doc
    .splitTextToSize(intro, colMidW)
    .slice(0, introMaxLines);
  const introTop = innerY + 110;
  doc.text(wrappedIntro, colMidX, introTop);
  const introBottom = introTop + wrappedIntro.length * introLineH;

  const reasons = [
    { title: "MORE REVENUE", body: "10–15% more income than long-term contracts." },
    { title: "NO COMMITMENT", body: "No long-term commitment with tenants." },
    { title: "FLEXIBILITY", body: "Sell your property whenever you want." },
    { title: "EASY MANAGEMENT", body: "Hassle-free management end-to-end." },
    { title: "FREEDOM TO USE", body: "Block your own dates whenever you need." },
    { title: "LESS FLUCTUATION", body: "Optimise revenue based on seasonality." },
    { title: "CAPITAL GAINS", body: "Higher sales price than long-term rentals." },
  ];
  const reasonsStartY = introBottom + 24;
  const reasonsAvailH = innerY + innerH - reasonsStartY - 10;
  const reasonsRowH = Math.min(32, reasonsAvailH / reasons.length);
  reasons.forEach((r, i) => {
    const y = reasonsStartY + i * reasonsRowH;
    setFill(ACCENT);
    doc.circle(colMidX, y - 3, 3.2, "F");
    setText(ACCENT);
    doc.setFont(FONT, "bold");
    doc.setFontSize(11);
    doc.text(r.title, colMidX + 12, y);
    setText(INK);
    doc.setFont(FONT, "normal");
    doc.setFontSize(9.5);
    doc.text(r.body, colMidX + 12, y + 12);
  });

  // --- Right column: contact info stacked ---
  setText(MUTED);
  doc.setFont(FONT, "bold");
  doc.setFontSize(11);
  doc.text("CONTACT", colRightX, innerY + 110);
  setDraw(ACCENT);
  doc.setLineWidth(1.4);
  doc.line(colRightX, innerY + 116, colRightX + 36, innerY + 116);

  const contactItems: Array<{ label: string; value: string | null | undefined }> = [
    { label: "CALL", value: brand.phone },
    { label: "EMAIL", value: brand.email },
    { label: "WEB", value: brand.website },
  ];
  let contactY = innerY + 145;
  const contactRowH = 56;
  contactItems.forEach((item) => {
    if (!item.value) return;
    setFill(ACCENT);
    doc.circle(colRightX + 4, contactY - 3, 2.6, "F");
    setText(ACCENT);
    doc.setFont(FONT, "bold");
    doc.setFontSize(9);
    doc.text(item.label, colRightX + 14, contactY);
    setText(INK);
    doc.setFont(FONT, "bold");
    doc.setFontSize(11);
    const valueLines = doc.splitTextToSize(item.value, colRightW - 16);
    doc.text(valueLines, colRightX + 14, contactY + 14);
    contactY += contactRowH;
  });

  // ===== Slide 4 — Financial breakdown =====
  newPage();
  if (brand.logoDataUrl) drawLogo(innerX, innerY, 28);

  setText(INK);
  doc.setFont(FONT, "bold");
  doc.setFontSize(34);
  doc.text("FINANCIAL BREAKDOWN", innerX + 6, innerY + 90);

  const p = computeScenario(data.pessimisticNet, data);
  const r = computeScenario(data.realisticNet, data);
  const o = computeScenario(data.optimisticNet, data);
  const duYear = data.duMonthly * 12;
  const dewaYear = data.dewaChillerMonthly * 12;
  const maintenanceYear = data.maintenanceMonthly * 12;

  autoTable(doc, {
    startY: innerY + 120,
    margin: {
      left: innerX + 6,
      right: pageW - innerX - innerW + 6,
      bottom: pageH - (innerY + innerH) + 6,
    },
    tableWidth: innerW - 12,
    pageBreak: "avoid",
    head: [
      [
        { content: "Scenario", styles: { halign: "left" } },
        { content: "Pessimistic", styles: { halign: "center", fillColor: [193, 64, 65] as [number, number, number] } },
        { content: "Realistic", styles: { halign: "center", fillColor: [113, 168, 199] as [number, number, number] } },
        { content: "Optimistic", styles: { halign: "center", fillColor: [137, 188, 96] as [number, number, number] } },
      ],
    ],
    body: [
      [
        "Occupancy rate",
        `${data.pessimisticOccupancy}%`,
        `${data.realisticOccupancy}%`,
        `${data.optimisticOccupancy}%`,
      ],
      [
        { content: "Gross annual revenue", styles: { fontStyle: "bold" } },
        { content: fmt(p.gross), styles: { fontStyle: "bold" } },
        { content: fmt(r.gross), styles: { fontStyle: "bold" } },
        { content: fmt(o.gross), styles: { fontStyle: "bold" } },
      ],
      ["Portal fees (Booking, Airbnb…)", fmt(p.portal), fmt(r.portal), fmt(o.portal)],
      ["Du (Internet)", fmt(duYear), fmt(duYear), fmt(duYear)],
      ["DEWA + Chiller", fmt(dewaYear), fmt(dewaYear), fmt(dewaYear)],
      ["Property insurance", fmt(data.propertyInsuranceYearly), fmt(data.propertyInsuranceYearly), fmt(data.propertyInsuranceYearly)],
      ["DTCM registration", fmt(data.dtcmPermitYearly), fmt(data.dtcmPermitYearly), fmt(data.dtcmPermitYearly)],
      ["Maintenance and wear & tear", fmt(maintenanceYear), fmt(maintenanceYear), fmt(maintenanceYear)],
      ["Management fee", fmt(p.managementFee), fmt(r.managementFee), fmt(o.managementFee)],
      ["VAT", fmt(p.vat), fmt(r.vat), fmt(o.vat)],
      [
        { content: "Total operating expenses", styles: { fontStyle: "bold", fillColor: [220, 220, 220] as [number, number, number] } },
        { content: fmt(p.totalExpenses), styles: { fontStyle: "bold", fillColor: [220, 220, 220] as [number, number, number] } },
        { content: fmt(r.totalExpenses), styles: { fontStyle: "bold", fillColor: [220, 220, 220] as [number, number, number] } },
        { content: fmt(o.totalExpenses), styles: { fontStyle: "bold", fillColor: [220, 220, 220] as [number, number, number] } },
      ],
    ],
    foot: [
      [
        { content: "Net annual income", styles: { halign: "left", fontStyle: "bold" } },
        { content: fmt(p.net), styles: { fontStyle: "bold" } },
        { content: fmt(r.net), styles: { fontStyle: "bold" } },
        { content: fmt(o.net), styles: { fontStyle: "bold" } },
      ],
    ],
    theme: "grid",
    styles: {
      font: FONT,
      fontSize: 9.5,
      cellPadding: 5,
      lineColor: BORDER,
      lineWidth: 0.6,
      textColor: INK,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [200, 200, 200],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
    },
    bodyStyles: { halign: "right" },
    columnStyles: {
      0: { halign: "left", fontStyle: "normal" },
    },
    footStyles: {
      fillColor: [183, 63, 102],
      textColor: [255, 255, 255],
      halign: "right",
      fontStyle: "bold",
      fontSize: 11,
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
  });

  const safeName = safeFile(
    `${data.buildingName || data.propertyName}-projection`,
  );
  doc.save(`${safeName}.pdf`);
}
