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

// Premium palette — warm ivory surfaces, deep slate ink, hair-thin
// gold accents, brand rose reserved for emphatic callouts.
const CREAM: [number, number, number] = [251, 248, 241];
const CREAM_DEEP: [number, number, number] = [244, 238, 224];
const INK: [number, number, number] = [33, 41, 54];
const INK_SOFT: [number, number, number] = [92, 102, 117];
const GOLD: [number, number, number] = [187, 153, 102];
const GOLD_SOFT: [number, number, number] = [228, 215, 188];
const GOLD_FAINT: [number, number, number] = [242, 234, 217];
const LINE: [number, number, number] = [212, 200, 175];
const ROSE: [number, number, number] = [183, 63, 102];
const WHITE: [number, number, number] = [255, 255, 255];

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
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth(); // 842
  const pageH = doc.internal.pageSize.getHeight(); // 595
  const FONT = "helvetica";

  // Pre-load shared assets once.
  const buildingPng = await loadBuildingImageDataUrl();
  const buildingNat = await loadBuildingImageSize(buildingPng);
  const aboutPng = await svgToPng(ABOUT_SVG, 720, 720);

  const M = 28;
  const innerX = M;
  const innerY = M;
  const innerW = pageW - M * 2;
  const innerH = pageH - M * 2;

  const setFill = (rgb: [number, number, number]) =>
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  const setText = (rgb: [number, number, number]) =>
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  const setDraw = (rgb: [number, number, number]) =>
    doc.setDrawColor(rgb[0], rgb[1], rgb[2]);

  const TOTAL = 4;

  // ---------- Background art ----------------------------------------
  // Painted-paper feel: ivory wash + two soft gold "watercolor" blobs
  // in opposing corners + a faint diagonal hairline that catches the
  // light. Each slide gets a different rotation so the deck reads as
  // a sequence rather than four copies of the same page.
  const drawBg = (variant: 0 | 1 | 2 | 3) => {
    // Base wash
    setFill(CREAM);
    doc.rect(0, 0, pageW, pageH, "F");

    // Top corner soft "watercolor" blob — three nested ellipses of
    // decreasing radius and slightly stronger tint give a painted
    // gradient without needing a real gradient API.
    const blobs: Array<{ cx: number; cy: number; rx: number; ry: number }> = [
      variant % 2 === 0
        ? { cx: pageW - 60, cy: 60, rx: 380, ry: 220 }
        : { cx: 60, cy: 60, rx: 380, ry: 220 },
      variant < 2
        ? { cx: 60, cy: pageH - 40, rx: 320, ry: 200 }
        : { cx: pageW - 60, cy: pageH - 40, rx: 320, ry: 200 },
    ];
    blobs.forEach((b) => {
      setFill(GOLD_FAINT);
      doc.ellipse(b.cx, b.cy, b.rx, b.ry, "F");
      setFill(CREAM_DEEP);
      doc.ellipse(b.cx, b.cy, b.rx * 0.65, b.ry * 0.65, "F");
    });

    // Faint diagonal hairline crossing the page — subtle motion.
    setDraw(GOLD_SOFT);
    doc.setLineWidth(0.25);
    if (variant % 2 === 0) {
      doc.line(0, pageH * 0.78, pageW, pageH * 0.22);
    } else {
      doc.line(0, pageH * 0.22, pageW, pageH * 0.78);
    }

    // Inner gold hairline frame
    setDraw(GOLD);
    doc.setLineWidth(0.5);
    doc.rect(M - 6, M - 6, pageW - 2 * (M - 6), pageH - 2 * (M - 6), "S");
    // Inner double frame (very thin, slightly inset)
    setDraw(GOLD_SOFT);
    doc.setLineWidth(0.3);
    doc.rect(M - 2, M - 2, pageW - 2 * (M - 2), pageH - 2 * (M - 2), "S");

    // Subtle corner L-ticks
    setDraw(GOLD);
    doc.setLineWidth(1.2);
    const tick = 14;
    const off = M - 6;
    doc.line(off, off, off + tick, off);
    doc.line(off, off, off, off + tick);
    doc.line(pageW - off, off, pageW - off - tick, off);
    doc.line(pageW - off, off, pageW - off, off + tick);
    doc.line(off, pageH - off, off + tick, pageH - off);
    doc.line(off, pageH - off, off, pageH - off - tick);
    doc.line(pageW - off, pageH - off, pageW - off - tick, pageH - off);
    doc.line(pageW - off, pageH - off, pageW - off, pageH - off - tick);
  };

  const drawLogo = (x: number, y: number, h = 28) => {
    if (!brand.logoDataUrl) {
      setText(INK);
      doc.setFont(FONT, "bold");
      doc.setFontSize(15);
      doc.text(brand.name, x, y + h * 0.7);
      return;
    }
    const m = /^data:([^;]+);base64,/.exec(brand.logoDataUrl);
    const format = /jpeg|jpg/i.test(m?.[1] ?? "") ? "JPEG" : "PNG";
    try {
      doc.addImage(brand.logoDataUrl, format, x, y, h * 3, h, undefined, "FAST");
    } catch {
      /* noop */
    }
  };

  const drawHeader = (page: number, label: string) => {
    drawLogo(innerX + 6, innerY + 4, 28);
    setText(INK_SOFT);
    doc.setFont(FONT, "bold");
    doc.setFontSize(8);
    doc.text(label.toUpperCase(), pageW - innerX - 6, innerY + 16, {
      align: "right",
    });
    setText(GOLD);
    doc.setFont(FONT, "bold");
    doc.setFontSize(11);
    doc.text(
      `${String(page).padStart(2, "0")} / 0${TOTAL}`,
      pageW - innerX - 6,
      innerY + 32,
      { align: "right" },
    );
  };

  const drawFooter = () => {
    const fy = pageH - innerY - 14;
    setDraw(GOLD_SOFT);
    doc.setLineWidth(0.4);
    doc.line(innerX + 10, fy - 8, pageW - innerX - 10, fy - 8);
    setText(INK_SOFT);
    doc.setFont(FONT, "normal");
    doc.setFontSize(8);
    doc.text(brand.name, innerX + 10, fy);
    if (brand.website) {
      doc.text(brand.website, pageW - innerX - 10, fy, { align: "right" });
    }
  };

  // Section-title slug used on every slide: tiny gold eyebrow + short
  // gold underline. Centralised so every slide shares the same rhythm.
  const drawEyebrow = (text: string, x: number, y: number) => {
    setText(GOLD);
    doc.setFont(FONT, "bold");
    doc.setFontSize(10);
    doc.text(text.toUpperCase(), x, y);
    setDraw(GOLD);
    doc.setLineWidth(1.3);
    doc.line(x, y + 6, x + 24, y + 6);
  };

  const newSlide = () => doc.addPage("a4", "landscape");

  // ===== Slide 1 — Hero ==============================================
  drawBg(0);
  drawHeader(1, "Investment proposal");
  drawFooter();

  const heroX = innerX + 18;
  const heroTopY = innerY + 96;
  drawEyebrow("Monthly net income", heroX, heroTopY);

  setText(INK);
  doc.setFont(FONT, "bold");
  doc.setFontSize(58);
  doc.text(
    `AED ${data.avgMonthlyNet.toLocaleString("en-GB", {
      maximumFractionDigits: 0,
    })}`,
    heroX,
    heroTopY + 64,
  );
  setText(INK_SOFT);
  doc.setFont(FONT, "normal");
  doc.setFontSize(14);
  doc.text("on average · per month for your property", heroX, heroTopY + 92);

  setDraw(GOLD);
  doc.setLineWidth(0.6);
  doc.line(heroX, heroTopY + 112, heroX + 380, heroTopY + 112);

  setText(INK);
  doc.setFont(FONT, "bold");
  doc.setFontSize(26);
  doc.text(
    (data.buildingName || data.propertyName).toUpperCase(),
    heroX,
    heroTopY + 146,
  );
  setText(INK_SOFT);
  doc.setFont(FONT, "normal");
  doc.setFontSize(13);
  doc.text((data.area || "—").toUpperCase(), heroX, heroTopY + 170);

  // Right-side hero image — building PNG, centered in its half.
  const natRatio = buildingNat.width / buildingNat.height;
  const rightX = pageW / 2 + 24;
  const rightW = pageW - rightX - innerX - 24;
  const heroImgMaxW = rightW - 20;
  const heroImgMaxH = 240;
  let illW = heroImgMaxW;
  let illH = illW / natRatio;
  if (illH > heroImgMaxH) {
    illH = heroImgMaxH;
    illW = illH * natRatio;
  }
  const illX = rightX + (rightW - illW) / 2;
  const illY = innerY + 110;
  doc.addImage(buildingPng, "PNG", illX, illY, illW, illH, undefined, "FAST");

  // Meta strip at the bottom — 3 cells with gold dividers.
  const stripY = innerY + innerH - 100;
  setDraw(GOLD);
  doc.setLineWidth(0.8);
  doc.line(innerX + 10, stripY - 14, pageW - innerX - 10, stripY - 14);

  const stripItems: Array<{ label: string; value: string }> = [
    { label: "AREA", value: (data.area || "—").toUpperCase() },
    {
      label: "BUILDING",
      value: (data.buildingName || data.propertyName).toUpperCase(),
    },
    {
      label: "BEDROOMS",
      value:
        data.bedrooms === 1 ? "1 BEDROOM" : `${data.bedrooms} BEDROOMS`,
    },
  ];
  const cellW = (innerW - 20) / 3;
  stripItems.forEach((item, i) => {
    const cx = innerX + 10 + i * cellW + 12;
    setText(GOLD);
    doc.setFont(FONT, "bold");
    doc.setFontSize(8);
    doc.text(item.label, cx, stripY + 6);
    setText(INK);
    doc.setFont(FONT, "bold");
    doc.setFontSize(15);
    doc.text(item.value, cx, stripY + 32);
    if (i < stripItems.length - 1) {
      setDraw(GOLD_SOFT);
      doc.setLineWidth(0.5);
      const dx = innerX + 10 + (i + 1) * cellW;
      doc.line(dx, stripY - 4, dx, stripY + 48);
    }
  });

  // Cost list slotted on the right column under the building hero.
  const costs: Array<{ label: string; value: string; unit: string }> = [
    {
      label: "Du · Internet",
      value: `${data.duMonthly.toLocaleString("en-GB")} AED`,
      unit: "/ month",
    },
    {
      label: "DEWA + Chiller",
      value: `${data.dewaChillerMonthly.toLocaleString("en-GB")} AED`,
      unit: "/ month",
    },
    {
      label: "Property insurance",
      value: `${data.propertyInsuranceYearly.toLocaleString("en-GB")} AED`,
      unit: "/ year",
    },
    {
      label: "Maintenance",
      value: `${data.maintenanceMonthly.toLocaleString("en-GB")} AED`,
      unit: "/ month",
    },
    {
      label: "DTCM unit permit",
      value: `${data.dtcmPermitYearly.toLocaleString("en-GB")} AED`,
      unit: "/ year",
    },
  ];
  // Tight 2-column cost grid under the hero number.
  const costGridX = heroX;
  const costGridTop = heroTopY + 196;
  const costGridGap = 16;
  const costGridW = (pageW / 2 - 30 - heroX - costGridGap) / 2;
  costs.slice(0, 4).forEach((c, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = costGridX + col * (costGridW + costGridGap);
    const cy = costGridTop + row * 50;
    // gold dot
    setFill(GOLD);
    doc.circle(cx + 3, cy - 2, 2.4, "F");
    setText(INK_SOFT);
    doc.setFont(FONT, "normal");
    doc.setFontSize(9);
    doc.text(c.label, cx + 14, cy - 4);
    setText(INK);
    doc.setFont(FONT, "bold");
    doc.setFontSize(15);
    doc.text(c.value, cx + 14, cy + 14);
    setText(GOLD);
    doc.setFont(FONT, "normal");
    doc.setFontSize(8);
    doc.text(c.unit, cx + 14 + doc.getTextWidth(c.value) + 6, cy + 14);
  });
  // 5th cost spans both columns at the bottom
  {
    const c = costs[4];
    const cy = costGridTop + 2 * 50;
    setFill(GOLD);
    doc.circle(costGridX + 3, cy - 2, 2.4, "F");
    setText(INK_SOFT);
    doc.setFont(FONT, "normal");
    doc.setFontSize(9);
    doc.text(c.label, costGridX + 14, cy - 4);
    setText(INK);
    doc.setFont(FONT, "bold");
    doc.setFontSize(15);
    doc.text(c.value, costGridX + 14, cy + 14);
    setText(GOLD);
    doc.setFont(FONT, "normal");
    doc.setFontSize(8);
    doc.text(c.unit, costGridX + 14 + doc.getTextWidth(c.value) + 6, cy + 14);
  }

  // ===== Slide 2 — Our services ======================================
  newSlide();
  drawBg(1);
  drawHeader(2, "Our services");
  drawFooter();

  drawEyebrow("What you get", innerX + 18, innerY + 90);
  setText(INK);
  doc.setFont(FONT, "bold");
  doc.setFontSize(38);
  doc.text("Our services", innerX + 18, innerY + 130);

  // Subline with rose accent on the fee.
  setText(INK_SOFT);
  doc.setFont(FONT, "normal");
  doc.setFontSize(13);
  let sublineX = innerX + 18;
  const sublineY = innerY + 158;
  doc.text("We charge a ", sublineX, sublineY);
  sublineX += doc.getTextWidth("We charge a ");
  setText(ROSE);
  doc.setFont(FONT, "bold");
  const feeText = `${data.managementFeePct}% management fee + VAT`;
  doc.text(feeText, sublineX, sublineY);
  sublineX += doc.getTextWidth(feeText);
  setText(INK_SOFT);
  doc.setFont(FONT, "normal");
  doc.text(" on the revenue generated.", sublineX, sublineY);

  // Three elegant service cards — cream with thin gold top accent and
  // a numbered roman numeral in the header.
  const cards: Array<{ num: string; title: string; bullets: string[] }> = [
    {
      num: "I",
      title: "Listing management",
      bullets: splitBullets(data.listingMgmtBullets),
    },
    {
      num: "II",
      title: "Guest management",
      bullets: splitBullets(data.guestMgmtBullets),
    },
    {
      num: "III",
      title: "Property management",
      bullets: splitBullets(data.propertyMgmtBullets),
    },
  ];
  const svcTop = innerY + 190;
  const svcGap = 22;
  const svcW = (innerW - 36 - svcGap * 2) / 3;
  const svcH = innerH - (svcTop - innerY) - 36;
  cards.forEach((card, i) => {
    const x = innerX + 18 + i * (svcW + svcGap);
    // Card surface
    setFill(WHITE);
    setDraw(GOLD_SOFT);
    doc.setLineWidth(0.6);
    doc.roundedRect(x, svcTop, svcW, svcH, 10, 10, "FD");
    // Gold accent band on top
    setFill(GOLD);
    doc.roundedRect(x, svcTop, svcW, 4, 2, 2, "F");
    // Roman numeral large in the corner, very thin gold
    setText(GOLD);
    doc.setFont(FONT, "bold");
    doc.setFontSize(34);
    doc.text(card.num, x + svcW - 18, svcTop + 50, { align: "right" });
    // Title
    setText(INK);
    doc.setFont(FONT, "bold");
    doc.setFontSize(14);
    doc.text(card.title.toUpperCase(), x + 18, svcTop + 38);
    // gold underline
    setDraw(GOLD);
    doc.setLineWidth(1.2);
    doc.line(x + 18, svcTop + 46, x + 38, svcTop + 46);
    // Bullets
    const bulletStartY = svcTop + 78;
    card.bullets.forEach((b, idx) => {
      const by = bulletStartY + idx * 22;
      // Tiny gold dot
      setFill(GOLD);
      doc.circle(x + 22, by - 3, 1.6, "F");
      setText(INK);
      doc.setFont(FONT, "bold");
      doc.setFontSize(10.5);
      doc.text(b, x + 30, by);
    });
  });

  // ===== Slide 3 — About us / Why us =================================
  newSlide();
  drawBg(2);
  drawHeader(3, "About us");
  drawFooter();

  drawEyebrow("Who we are", innerX + 18, innerY + 90);
  setText(INK);
  doc.setFont(FONT, "bold");
  doc.setFontSize(38);
  doc.text("Built for elegant returns", innerX + 18, innerY + 130);

  // 3-column body: illustration · reasons · contact
  const colLeftX = innerX + 18;
  const colLeftW = 230;
  const colMidX = innerX + 270;
  const colMidW = 330;
  const colRightX = innerX + innerW - 200;
  const colRightW = 182;

  // Left: SVG illustration
  const aboutSize = Math.min(colLeftW, 220);
  doc.addImage(
    aboutPng,
    "PNG",
    colLeftX + (colLeftW - aboutSize) / 2,
    innerY + 180,
    aboutSize,
    aboutSize,
    undefined,
    "FAST",
  );

  // Middle: intro + reasons
  setText(INK_SOFT);
  doc.setFont(FONT, "normal");
  doc.setFontSize(13);
  const introLines = doc
    .splitTextToSize(data.aboutText || "", colMidW)
    .slice(0, 3);
  doc.text(introLines, colMidX, innerY + 175);

  const reasons = [
    { title: "More revenue", body: "10–15% more income than long-term contracts." },
    { title: "No commitment", body: "No long-term commitment with tenants." },
    { title: "Flexibility", body: "Sell your property whenever you want." },
    { title: "Easy management", body: "Hassle-free management end-to-end." },
    { title: "Freedom to use", body: "Block your own dates whenever you need." },
    { title: "Less fluctuation", body: "Optimise revenue based on seasonality." },
    { title: "Capital gains", body: "Higher sales price than long-term rentals." },
  ];
  const reasonsTop = innerY + 240;
  const reasonsAvailH = innerY + innerH - reasonsTop - 36;
  const reasonsRowH = reasonsAvailH / reasons.length;
  reasons.forEach((r, i) => {
    const y = reasonsTop + i * reasonsRowH;
    setFill(GOLD);
    doc.circle(colMidX + 2, y - 3, 2.6, "F");
    setText(INK);
    doc.setFont(FONT, "bold");
    doc.setFontSize(11);
    doc.text(r.title.toUpperCase(), colMidX + 12, y);
    setText(INK_SOFT);
    doc.setFont(FONT, "normal");
    doc.setFontSize(9.5);
    doc.text(r.body, colMidX + 12, y + 12);
  });

  // Right: contact card
  const contactY = innerY + 175;
  const contactH = innerH - (contactY - innerY) - 60;
  setFill(GOLD_FAINT);
  setDraw(GOLD);
  doc.setLineWidth(0.7);
  doc.roundedRect(colRightX, contactY, colRightW, contactH, 10, 10, "FD");
  setText(GOLD);
  doc.setFont(FONT, "bold");
  doc.setFontSize(9);
  doc.text("GET IN TOUCH", colRightX + 18, contactY + 28);
  setDraw(GOLD);
  doc.setLineWidth(1.2);
  doc.line(colRightX + 18, contactY + 34, colRightX + 18 + 30, contactY + 34);
  setText(INK);
  doc.setFont(FONT, "bold");
  doc.setFontSize(16);
  doc.text("Talk to us", colRightX + 18, contactY + 62);

  const contactItems: Array<{ label: string; value: string | null }> = [
    { label: "CALL", value: brand.phone ?? null },
    { label: "EMAIL", value: brand.email ?? null },
    { label: "WEB", value: brand.website ?? null },
  ];
  let cy = contactY + 96;
  contactItems.forEach((item) => {
    if (!item.value) return;
    setText(GOLD);
    doc.setFont(FONT, "bold");
    doc.setFontSize(8);
    doc.text(item.label, colRightX + 18, cy);
    setText(INK);
    doc.setFont(FONT, "bold");
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(item.value, colRightW - 36);
    doc.text(lines, colRightX + 18, cy + 14);
    cy += 14 + lines.length * 12 + 12;
  });

  // ===== Slide 4 — Financial breakdown ===============================
  newSlide();
  drawBg(3);
  drawHeader(4, "Financial breakdown");
  drawFooter();

  drawEyebrow("The numbers", innerX + 18, innerY + 90);
  setText(INK);
  doc.setFont(FONT, "bold");
  doc.setFontSize(38);
  doc.text("Financial breakdown", innerX + 18, innerY + 130);

  setText(INK_SOFT);
  doc.setFont(FONT, "normal");
  doc.setFontSize(12);
  doc.text(
    "Three forecast scenarios. The realistic column reflects our typical year.",
    innerX + 18,
    innerY + 156,
  );

  const p = computeScenario(data.pessimisticNet, data);
  const r = computeScenario(data.realisticNet, data);
  const o = computeScenario(data.optimisticNet, data);
  const duYear = data.duMonthly * 12;
  const dewaYear = data.dewaChillerMonthly * 12;
  const maintenanceYear = data.maintenanceMonthly * 12;

  autoTable(doc, {
    startY: innerY + 180,
    margin: {
      left: innerX + 18,
      right: pageW - innerX - innerW + 18,
      bottom: pageH - (innerY + innerH) + 14,
    },
    tableWidth: innerW - 36,
    pageBreak: "avoid",
    head: [
      [
        { content: "Scenario", styles: { halign: "left" } },
        {
          content: "Pessimistic",
          styles: {
            halign: "center",
            fillColor: [193, 64, 65] as [number, number, number],
          },
        },
        {
          content: "Realistic",
          styles: {
            halign: "center",
            fillColor: [113, 168, 199] as [number, number, number],
          },
        },
        {
          content: "Optimistic",
          styles: {
            halign: "center",
            fillColor: [137, 188, 96] as [number, number, number],
          },
        },
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
        { content: "Gross annual revenue", styles: { fontStyle: "bold", textColor: INK } },
        { content: fmt(p.gross), styles: { fontStyle: "bold" } },
        { content: fmt(r.gross), styles: { fontStyle: "bold" } },
        { content: fmt(o.gross), styles: { fontStyle: "bold" } },
      ],
      [
        "Portal fees (Booking, Airbnb…)",
        fmt(p.portal),
        fmt(r.portal),
        fmt(o.portal),
      ],
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
        "Maintenance & wear and tear",
        fmt(maintenanceYear),
        fmt(maintenanceYear),
        fmt(maintenanceYear),
      ],
      ["Management fee", fmt(p.managementFee), fmt(r.managementFee), fmt(o.managementFee)],
      ["VAT", fmt(p.vat), fmt(r.vat), fmt(o.vat)],
      [
        { content: "Total operating expenses", styles: { fontStyle: "bold", fillColor: GOLD_SOFT } },
        { content: fmt(p.totalExpenses), styles: { fontStyle: "bold", fillColor: GOLD_SOFT } },
        { content: fmt(r.totalExpenses), styles: { fontStyle: "bold", fillColor: GOLD_SOFT } },
        { content: fmt(o.totalExpenses), styles: { fontStyle: "bold", fillColor: GOLD_SOFT } },
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
      cellPadding: 6,
      lineColor: LINE,
      lineWidth: 0.4,
      textColor: INK,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [240, 232, 215],
      textColor: INK,
      fontStyle: "bold",
      halign: "center",
    },
    bodyStyles: { halign: "right", fillColor: WHITE },
    columnStyles: {
      0: { halign: "left", fontStyle: "normal", textColor: INK_SOFT },
    },
    footStyles: {
      fillColor: ROSE,
      textColor: WHITE,
      halign: "right",
      fontStyle: "bold",
      fontSize: 11,
    },
    alternateRowStyles: { fillColor: [252, 248, 240] },
  });

  const safeName = safeFile(
    `${data.buildingName || data.propertyName}-projection`,
  );
  doc.save(`${safeName}.pdf`);
}
