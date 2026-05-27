"use client";

import { formatCurrency } from "@/lib/utils";
import {
  computeScenario,
  type ProjectionBrand,
  type ProjectionData,
} from "./projection-editor";
import {
  renderTower3D,
  renderServiceIcon3D,
  renderScenarioChart3D,
} from "./three-scenes";
import type { Locale } from "@/i18n/config";

// Premium palette — warm cream surfaces, deep slate ink, hair-thin
// gold accents, brand rose for emphatic callouts only.
const CREAM: [number, number, number] = [250, 246, 238];
const INK: [number, number, number] = [31, 39, 52];
const INK_SOFT: [number, number, number] = [85, 95, 110];
const GOLD: [number, number, number] = [197, 165, 114];
const GOLD_SOFT: [number, number, number] = [232, 220, 196];
const LINE: [number, number, number] = [205, 192, 168];
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

  // Render every 3D scene in parallel — these all happen once at the
  // start of the export so the rest of the routine is purely 2D draw
  // calls that stream PNGs into the document.
  const [towerPng, listingPng, guestPng, propertyPng, chartPng] =
    await Promise.all([
      renderTower3D(960, 960),
      renderServiceIcon3D("listing", 560, 560),
      renderServiceIcon3D("guest", 560, 560),
      renderServiceIcon3D("property", 560, 560),
      renderScenarioChart3D(
        {
          pessimistic: computeScenario(data.pessimisticNet, data).gross,
          realistic: computeScenario(data.realisticNet, data).gross,
          optimistic: computeScenario(data.optimisticNet, data).gross,
        },
        920,
        620,
      ),
    ]);

  const M = 30; // outer margin (inside page)
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

  const TOTAL = 5;

  // --- Page chrome ---------------------------------------------------
  const drawBg = () => {
    setFill(CREAM);
    doc.rect(0, 0, pageW, pageH, "F");
    // Inner gold hairline frame.
    setDraw(GOLD);
    doc.setLineWidth(0.5);
    doc.rect(M - 6, M - 6, pageW - 2 * (M - 6), pageH - 2 * (M - 6), "S");
    // Decorative inner double frame, just a few mm in.
    setDraw(GOLD_SOFT);
    doc.setLineWidth(0.3);
    doc.rect(M - 2, M - 2, pageW - 2 * (M - 2), pageH - 2 * (M - 2), "S");
    // Corner ornaments — short L-shaped gold ticks.
    setDraw(GOLD);
    doc.setLineWidth(1.4);
    const tick = 16;
    const off = M - 6;
    // Top-left
    doc.line(off, off, off + tick, off);
    doc.line(off, off, off, off + tick);
    // Top-right
    doc.line(pageW - off, off, pageW - off - tick, off);
    doc.line(pageW - off, off, pageW - off, off + tick);
    // Bottom-left
    doc.line(off, pageH - off, off + tick, pageH - off);
    doc.line(off, pageH - off, off, pageH - off - tick);
    // Bottom-right
    doc.line(pageW - off, pageH - off, pageW - off - tick, pageH - off);
    doc.line(pageW - off, pageH - off, pageW - off, pageH - off - tick);
  };

  const drawLogo = (x: number, y: number, h = 30) => {
    if (!brand.logoDataUrl) {
      setText(INK);
      doc.setFont(FONT, "bold");
      doc.setFontSize(16);
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
    // Top-right cluster: section label + page indicator.
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
    const fy = pageH - innerY - 16;
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

  const newSlide = () => doc.addPage("a4", "landscape");

  // ===== Slide 1 — Hero ===============================================
  drawBg();
  drawHeader(1, "Investment proposal");
  drawFooter();

  // Left column — hero number + property essentials.
  const heroX = innerX + 18;
  const heroTopY = innerY + 100;
  setText(GOLD);
  doc.setFont(FONT, "bold");
  doc.setFontSize(9);
  doc.text("MONTHLY NET INCOME", heroX, heroTopY);
  setDraw(GOLD);
  doc.setLineWidth(1.4);
  doc.line(heroX, heroTopY + 6, heroX + 24, heroTopY + 6);

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
  doc.text("on average · per month for your property", heroX, heroTopY + 90);

  // Hairline divider
  setDraw(GOLD);
  doc.setLineWidth(0.6);
  doc.line(heroX, heroTopY + 110, heroX + 380, heroTopY + 110);

  // Building / area summary
  setText(INK);
  doc.setFont(FONT, "bold");
  doc.setFontSize(26);
  doc.text(
    (data.buildingName || data.propertyName).toUpperCase(),
    heroX,
    heroTopY + 144,
  );
  setText(INK_SOFT);
  doc.setFont(FONT, "normal");
  doc.setFontSize(13);
  doc.text((data.area || "—").toUpperCase(), heroX, heroTopY + 168);

  // Right column — 3D tower render
  const towerSize = 330;
  const towerX = innerX + innerW - towerSize - 30;
  const towerY = innerY + 60;
  doc.addImage(
    towerPng,
    "PNG",
    towerX,
    towerY,
    towerSize,
    towerSize,
    undefined,
    "FAST",
  );

  // Meta strip — 3 elegant cells with gold separators.
  const stripY = innerY + innerH - 92;
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
    doc.setFontSize(16);
    doc.text(item.value, cx, stripY + 32);
    if (i < stripItems.length - 1) {
      setDraw(GOLD_SOFT);
      doc.setLineWidth(0.5);
      const dx = innerX + 10 + (i + 1) * cellW;
      doc.line(dx, stripY - 4, dx, stripY + 48);
    }
  });

  // ===== Slide 2 — Expected monthly costs =============================
  newSlide();
  drawBg();
  drawHeader(2, "Operating costs");
  drawFooter();

  setText(GOLD);
  doc.setFont(FONT, "bold");
  doc.setFontSize(10);
  doc.text("WHAT YOU PAY", innerX + 18, innerY + 90);
  setDraw(GOLD);
  doc.setLineWidth(1.4);
  doc.line(innerX + 18, innerY + 96, innerX + 18 + 24, innerY + 96);

  setText(INK);
  doc.setFont(FONT, "bold");
  doc.setFontSize(38);
  doc.text("Expected monthly costs", innerX + 18, innerY + 132);

  setText(INK_SOFT);
  doc.setFont(FONT, "normal");
  doc.setFontSize(13);
  doc.text(
    "Transparent line-items pulled directly from your projection.",
    innerX + 18,
    innerY + 158,
  );

  // Two-column elegant grid of cost cards.
  const costs: Array<{ label: string; value: string; unit: string }> = [
    {
      label: "Du · Internet",
      value: data.duMonthly.toLocaleString("en-GB"),
      unit: "AED / month",
    },
    {
      label: "DEWA + Chiller",
      value: data.dewaChillerMonthly.toLocaleString("en-GB"),
      unit: "AED / month",
    },
    {
      label: "Property insurance",
      value: data.propertyInsuranceYearly.toLocaleString("en-GB"),
      unit: "AED / year",
    },
    {
      label: "Maintenance",
      value: data.maintenanceMonthly.toLocaleString("en-GB"),
      unit: "AED / month",
    },
    {
      label: "DTCM unit permit",
      value: data.dtcmPermitYearly.toLocaleString("en-GB"),
      unit: "AED / year",
    },
  ];

  const gridTop = innerY + 200;
  const gridGap = 18;
  const cardW = (innerW - 36 - gridGap) / 2;
  const cardH = 78;
  costs.forEach((c, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = innerX + 18 + col * (cardW + gridGap);
    const cy = gridTop + row * (cardH + gridGap);
    // Card surface
    setFill(WHITE);
    setDraw(GOLD_SOFT);
    doc.setLineWidth(0.6);
    doc.roundedRect(cx, cy, cardW, cardH, 6, 6, "FD");
    // Small gold accent block on the left
    setFill(GOLD);
    doc.rect(cx, cy, 4, cardH, "F");
    // Label
    setText(INK_SOFT);
    doc.setFont(FONT, "normal");
    doc.setFontSize(11);
    doc.text(c.label, cx + 18, cy + 26);
    // Big value
    setText(INK);
    doc.setFont(FONT, "bold");
    doc.setFontSize(24);
    doc.text(c.value, cx + 18, cy + 58);
    setText(GOLD);
    doc.setFont(FONT, "normal");
    doc.setFontSize(10);
    const vw = doc.getTextWidth(c.value);
    doc.text(c.unit, cx + 18 + vw + 8, cy + 58);
  });

  // ===== Slide 3 — Our services =======================================
  newSlide();
  drawBg();
  drawHeader(3, "Our services");
  drawFooter();

  setText(GOLD);
  doc.setFont(FONT, "bold");
  doc.setFontSize(10);
  doc.text("WHAT YOU GET", innerX + 18, innerY + 90);
  setDraw(GOLD);
  doc.setLineWidth(1.4);
  doc.line(innerX + 18, innerY + 96, innerX + 18 + 24, innerY + 96);

  setText(INK);
  doc.setFont(FONT, "bold");
  doc.setFontSize(38);
  doc.text("Our services", innerX + 18, innerY + 132);

  // Subline with the rose accent on management fee.
  setText(INK_SOFT);
  doc.setFont(FONT, "normal");
  doc.setFontSize(13);
  let sublineX = innerX + 18;
  const sublineY = innerY + 162;
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

  // Three service cards
  const svcCards: Array<{
    title: string;
    bullets: string[];
    png: string;
  }> = [
    {
      title: "Listing management",
      bullets: splitBullets(data.listingMgmtBullets),
      png: listingPng,
    },
    {
      title: "Guest management",
      bullets: splitBullets(data.guestMgmtBullets),
      png: guestPng,
    },
    {
      title: "Property management",
      bullets: splitBullets(data.propertyMgmtBullets),
      png: propertyPng,
    },
  ];
  const svcTop = innerY + 200;
  const svcGap = 18;
  const svcW = (innerW - 36 - svcGap * 2) / 3;
  const svcH = innerH - (svcTop - innerY) - 40;
  svcCards.forEach((card, i) => {
    const x = innerX + 18 + i * (svcW + svcGap);
    // Card chrome
    setFill(WHITE);
    setDraw(GOLD_SOFT);
    doc.setLineWidth(0.6);
    doc.roundedRect(x, svcTop, svcW, svcH, 10, 10, "FD");
    // 3D icon top
    const iconSize = Math.min(svcW - 32, 130);
    const iconX = x + (svcW - iconSize) / 2;
    doc.addImage(
      card.png,
      "PNG",
      iconX,
      svcTop + 14,
      iconSize,
      iconSize,
      undefined,
      "FAST",
    );
    // Title
    setText(INK);
    doc.setFont(FONT, "bold");
    doc.setFontSize(13);
    doc.text(card.title.toUpperCase(), x + svcW / 2, svcTop + iconSize + 36, {
      align: "center",
    });
    // Gold divider
    setDraw(GOLD);
    doc.setLineWidth(1.2);
    doc.line(x + svcW / 2 - 16, svcTop + iconSize + 46, x + svcW / 2 + 16, svcTop + iconSize + 46);
    // Bullets
    setText(INK_SOFT);
    doc.setFont(FONT, "normal");
    doc.setFontSize(10);
    const bulletStartY = svcTop + iconSize + 70;
    card.bullets.forEach((b, idx) => {
      const by = bulletStartY + idx * 20;
      // Dot
      setFill(GOLD);
      doc.circle(x + 22, by - 3, 1.6, "F");
      setText(INK);
      doc.setFont(FONT, "bold");
      doc.setFontSize(10);
      doc.text(b, x + 30, by);
    });
  });

  // ===== Slide 4 — About us / Why us ==================================
  newSlide();
  drawBg();
  drawHeader(4, "About us");
  drawFooter();

  setText(GOLD);
  doc.setFont(FONT, "bold");
  doc.setFontSize(10);
  doc.text("WHO WE ARE", innerX + 18, innerY + 90);
  setDraw(GOLD);
  doc.setLineWidth(1.4);
  doc.line(innerX + 18, innerY + 96, innerX + 18 + 24, innerY + 96);

  setText(INK);
  doc.setFont(FONT, "bold");
  doc.setFontSize(38);
  doc.text("Built for elegant returns", innerX + 18, innerY + 132);

  // Intro paragraph (capped)
  setText(INK_SOFT);
  doc.setFont(FONT, "normal");
  doc.setFontSize(13);
  const intro = data.aboutText || "";
  const introLines = doc
    .splitTextToSize(intro, innerW - 36)
    .slice(0, 3);
  doc.text(introLines, innerX + 18, innerY + 160);

  // Reasons grid — 2 columns × 4 rows (last row only has Capital gains)
  const reasons = [
    {
      title: "More revenue",
      body: "10–15% more income than long-term contracts.",
    },
    { title: "No commitment", body: "No long-term commitment with tenants." },
    { title: "Flexibility", body: "Sell your property whenever you want." },
    { title: "Easy management", body: "Hassle-free management end-to-end." },
    { title: "Freedom to use", body: "Block your own dates whenever you need." },
    {
      title: "Less fluctuation",
      body: "Optimise revenue based on seasonality.",
    },
    {
      title: "Capital gains",
      body: "Higher sales price than long-term rentals.",
    },
  ];
  const reasonsTop = innerY + 232;
  const reasonsCols = 2;
  const reasonsGapX = 26;
  const reasonsGapY = 14;
  const reasonsCardW =
    (innerW - 36 - reasonsGapX * (reasonsCols - 1) - 220) /
    reasonsCols; // leave 220pt on the right for contact card
  const reasonsCardH = 56;
  reasons.forEach((r, i) => {
    const col = i % reasonsCols;
    const row = Math.floor(i / reasonsCols);
    const x = innerX + 18 + col * (reasonsCardW + reasonsGapX);
    const y = reasonsTop + row * (reasonsCardH + reasonsGapY);
    // Subtle card
    setFill(WHITE);
    setDraw(GOLD_SOFT);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, y, reasonsCardW, reasonsCardH, 6, 6, "FD");
    // Gold left accent
    setFill(GOLD);
    doc.rect(x, y, 3, reasonsCardH, "F");
    // Title
    setText(INK);
    doc.setFont(FONT, "bold");
    doc.setFontSize(12);
    doc.text(r.title.toUpperCase(), x + 12, y + 22);
    // Body
    setText(INK_SOFT);
    doc.setFont(FONT, "normal");
    doc.setFontSize(9.5);
    const bodyLines = doc.splitTextToSize(r.body, reasonsCardW - 24);
    doc.text(bodyLines, x + 12, y + 38);
  });

  // Contact card on the right
  const contactX = innerX + innerW - 200;
  const contactY = reasonsTop;
  const contactW = 182;
  const contactH = innerH - (reasonsTop - innerY) - 60;
  // Card with subtle gold-tinted bg
  setFill([245, 238, 222]);
  setDraw(GOLD);
  doc.setLineWidth(0.7);
  doc.roundedRect(contactX, contactY, contactW, contactH, 10, 10, "FD");
  setText(GOLD);
  doc.setFont(FONT, "bold");
  doc.setFontSize(9);
  doc.text("GET IN TOUCH", contactX + 18, contactY + 28);
  setDraw(GOLD);
  doc.setLineWidth(1.2);
  doc.line(contactX + 18, contactY + 34, contactX + 18 + 30, contactY + 34);
  setText(INK);
  doc.setFont(FONT, "bold");
  doc.setFontSize(15);
  doc.text("Talk to us", contactX + 18, contactY + 62);

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
    doc.text(item.label, contactX + 18, cy);
    setText(INK);
    doc.setFont(FONT, "bold");
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(item.value, contactW - 36);
    doc.text(lines, contactX + 18, cy + 16);
    cy += 16 + lines.length * 12 + 14;
  });

  // ===== Slide 5 — Financial breakdown ================================
  newSlide();
  drawBg();
  drawHeader(5, "Financial breakdown");
  drawFooter();

  setText(GOLD);
  doc.setFont(FONT, "bold");
  doc.setFontSize(10);
  doc.text("THE NUMBERS", innerX + 18, innerY + 90);
  setDraw(GOLD);
  doc.setLineWidth(1.4);
  doc.line(innerX + 18, innerY + 96, innerX + 18 + 24, innerY + 96);

  setText(INK);
  doc.setFont(FONT, "bold");
  doc.setFontSize(38);
  doc.text("Financial breakdown", innerX + 18, innerY + 132);

  setText(INK_SOFT);
  doc.setFont(FONT, "normal");
  doc.setFontSize(12);
  doc.text(
    "Three forecast scenarios. The realistic column reflects our typical year.",
    innerX + 18,
    innerY + 156,
  );

  // 3D chart on the right (illustrative)
  const chartW = 300;
  const chartH = 200;
  doc.addImage(
    chartPng,
    "PNG",
    innerX + innerW - chartW - 12,
    innerY + 70,
    chartW,
    chartH,
    undefined,
    "FAST",
  );
  setText(GOLD);
  doc.setFont(FONT, "bold");
  doc.setFontSize(8);
  doc.text(
    "GROSS REVENUE · 3 SCENARIOS",
    innerX + innerW - chartW / 2 - 12,
    innerY + 70 + chartH + 14,
    { align: "center" },
  );

  // Compute scenarios
  const p = computeScenario(data.pessimisticNet, data);
  const r = computeScenario(data.realisticNet, data);
  const o = computeScenario(data.optimisticNet, data);
  const duYear = data.duMonthly * 12;
  const dewaYear = data.dewaChillerMonthly * 12;
  const maintenanceYear = data.maintenanceMonthly * 12;

  // Refined table — taller rows, gold heading band, brand rose footer.
  autoTable(doc, {
    startY: innerY + 290,
    margin: {
      left: innerX + 18,
      right: pageW - innerX - innerW + 18,
      bottom: pageH - (innerY + innerH) + 18,
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
        {
          content: "Gross annual revenue",
          styles: { fontStyle: "bold", textColor: INK },
        },
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
        {
          content: "Total operating expenses",
          styles: { fontStyle: "bold", fillColor: GOLD_SOFT },
        },
        { content: fmt(p.totalExpenses), styles: { fontStyle: "bold", fillColor: GOLD_SOFT } },
        { content: fmt(r.totalExpenses), styles: { fontStyle: "bold", fillColor: GOLD_SOFT } },
        { content: fmt(o.totalExpenses), styles: { fontStyle: "bold", fillColor: GOLD_SOFT } },
      ],
    ],
    foot: [
      [
        {
          content: "Net annual income",
          styles: { halign: "left", fontStyle: "bold" },
        },
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
      fillColor: [240, 235, 222],
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
