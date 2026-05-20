"use client";

import type PptxGenJSType from "pptxgenjs";
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

// Hex palette — matches export-pdf.ts so both formats render the same.
const FRAME = "2D2D2D";
const INK = "3C3C3C";
const ACCENT = "B73F66";
const ACCENT_SOFT = "E8D7DE";
const MUTED = "6E747A";
const CARD_GRAY = "B8BEBC";
const SOFT = "F3F7F4";
const BORDER = "D9E0DC";
const FOOTER_SLATE = "5F6E69";
const FONT_FACE = "Arial";

function safeFile(name: string) {
  return name.replace(/[^\w\d\-_. ]+/g, "").trim();
}

function splitBullets(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(n);
}

export async function exportProjectionPptx(
  data: ProjectionData,
  brand: ProjectionBrand,
) {
  const { default: pptxgen } = await import("pptxgenjs");
  const pres = new pptxgen();
  pres.defineLayout({ name: "DECK_WIDE", width: 13.333, height: 7.5 });
  pres.layout = "DECK_WIDE";
  pres.title = `${brand.name} — ${data.buildingName || data.propertyName}`;
  pres.author = brand.legalName || brand.name;

  const inset = 0.25;
  const innerX = inset + 0.15;
  const innerY = inset + 0.15;
  const innerW = 13.333 - 2 * (inset + 0.15);
  const innerH = 7.5 - 2 * (inset + 0.15);

  // Master template — outer frame on every slide.
  pres.defineSlideMaster({
    title: "DECK_BASE",
    background: { color: "FFFFFF" },
    objects: [
      {
        rect: {
          x: inset,
          y: inset,
          w: 13.333 - 2 * inset,
          h: 7.5 - 2 * inset,
          fill: { color: "FFFFFF" },
          line: { color: FRAME, width: 3 },
          rectRadius: 0.12,
        },
      },
    ],
  });

  const addLogo = (s: PptxGenJSType.Slide) => {
    if (!brand.logoDataUrl) {
      s.addText(brand.name, {
        x: innerX,
        y: innerY,
        w: 4,
        h: 0.5,
        fontFace: FONT_FACE,
        fontSize: 18,
        bold: true,
        color: INK,
      });
      return;
    }
    s.addImage({
      data: brand.logoDataUrl,
      x: innerX,
      y: innerY,
      w: 1.6,
      h: 0.55,
      sizing: { type: "contain", w: 1.6, h: 0.55 },
    });
  };

  // ===== Slide 1 — Hero =====
  const s1 = pres.addSlide({ masterName: "DECK_BASE" });
  addLogo(s1);

  // Headline block — left column.
  const headlineY = innerY + 1.05;
  s1.addText("YOU COULD EARN", {
    x: innerX,
    y: headlineY,
    w: 8,
    h: 0.65,
    fontFace: FONT_FACE,
    fontSize: 34,
    bold: true,
    color: INK,
  });
  s1.addText(
    [
      {
        text: `AED ${data.avgMonthlyNet.toLocaleString("en-GB", { maximumFractionDigits: 0 })} NET `,
        options: { color: ACCENT, bold: true },
      },
      {
        text: "ON AVERAGE PER",
        options: { color: INK, bold: true },
      },
    ],
    {
      x: innerX,
      y: headlineY + 0.65,
      w: 8.5,
      h: 0.55,
      fontFace: FONT_FACE,
      fontSize: 22,
    },
  );
  s1.addText(
    [
      { text: "MONTH FOR ", options: { color: INK, bold: true } },
      { text: "YOUR PROPERTY", options: { color: ACCENT, bold: true } },
    ],
    {
      x: innerX,
      y: headlineY + 1.15,
      w: 8.5,
      h: 0.55,
      fontFace: FONT_FACE,
      fontSize: 22,
    },
  );

  // Meta rows.
  const meta: Array<{ label: string; value: string; glyph: string }> = [
    { label: "AREA", value: (data.area || "—").toUpperCase(), glyph: "◎" },
    {
      label: "BUILDING",
      value: (data.buildingName || data.propertyName).toUpperCase(),
      glyph: "▢",
    },
    {
      label: "BEDROOMS",
      value:
        data.bedrooms === 1 ? "1 BEDROOM" : `${data.bedrooms} BEDROOMS`,
      glyph: "⌂",
    },
  ];
  meta.forEach((m, i) => {
    const y = innerY + 3.4 + i * 1.0;
    // Icon disc
    s1.addShape(pres.ShapeType.ellipse, {
      x: innerX,
      y,
      w: 0.45,
      h: 0.45,
      fill: { color: "FFFFFF" },
      line: { color: INK, width: 1 },
    });
    s1.addText(m.glyph, {
      x: innerX,
      y,
      w: 0.45,
      h: 0.45,
      align: "center",
      valign: "middle",
      fontFace: FONT_FACE,
      fontSize: 16,
      bold: true,
      color: INK,
    });
    // Label
    s1.addText(m.label, {
      x: innerX + 0.6,
      y,
      w: 3,
      h: 0.3,
      fontFace: FONT_FACE,
      fontSize: 14,
      bold: true,
      color: ACCENT,
    });
    s1.addShape(pres.ShapeType.line, {
      x: innerX + 0.6,
      y: y + 0.3,
      w: 0.8,
      h: 0,
      line: { color: ACCENT, width: 1.5 },
    });
    // Value
    s1.addText(m.value, {
      x: innerX + 0.6,
      y: y + 0.35,
      w: 3.5,
      h: 0.3,
      fontFace: FONT_FACE,
      fontSize: 12,
      bold: true,
      color: INK,
    });
  });

  // Right column — title + cost card.
  const rightX = innerX + innerW / 2 + 0.4;
  s1.addText(
    [
      { text: "EXPECTED MONTHLY ", options: { color: INK, bold: true } },
      { text: "COSTS", options: { color: ACCENT, bold: true } },
    ],
    {
      x: rightX,
      y: headlineY,
      w: 6.5,
      h: 0.55,
      fontFace: FONT_FACE,
      fontSize: 22,
    },
  );
  // Clean right column: centered hero image (no panel) + tidy cost
  // list below. No leader lines — the layout speaks for itself.
  const rightColW = 13.333 - rightX - inset - 0.15;
  const buildingPng = await loadBuildingImageDataUrl();
  const buildingNat = await loadBuildingImageSize(buildingPng);
  const natRatio = buildingNat.width / buildingNat.height;
  const heroMaxW = rightColW - 0.5;
  const heroMaxH = 2.6;
  let illW = heroMaxW;
  let illH = illW / natRatio;
  if (illH > heroMaxH) {
    illH = heroMaxH;
    illW = illH * natRatio;
  }
  const illX = rightX + (rightColW - illW) / 2;
  const illY = headlineY + 0.7;
  s1.addImage({ data: buildingPng, x: illX, y: illY, w: illW, h: illH });

  // Cost list below the hero.
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
  const listX = rightX + 0.05;
  const listW = rightColW - 0.1;
  const listTop = illY + illH + 0.2;
  const listBottom = 7.5 - inset - 0.25;
  const rowH = (listBottom - listTop) / costs.length;
  costs.forEach((c, i) => {
    const rowTop = listTop + i * rowH;
    // Rose dot
    s1.addShape(pres.ShapeType.ellipse, {
      x: listX + 0.08,
      y: rowTop + rowH / 2 - 0.05,
      w: 0.1,
      h: 0.1,
      fill: { color: ACCENT },
      line: { color: ACCENT },
    });
    // Label
    s1.addText(c.label, {
      x: listX + 0.28,
      y: rowTop,
      w: listW * 0.55,
      h: rowH,
      fontFace: FONT_FACE,
      fontSize: 11,
      color: INK,
      valign: "middle",
    });
    // Value
    s1.addText(c.value, {
      x: listX + listW - 2.2,
      y: rowTop + 0.02,
      w: 2.1,
      h: rowH * 0.6,
      fontFace: FONT_FACE,
      fontSize: 15,
      bold: true,
      color: ACCENT,
      align: "right",
      valign: "middle",
    });
    // Unit
    s1.addText(c.unit, {
      x: listX + listW - 2.2,
      y: rowTop + rowH * 0.55,
      w: 2.1,
      h: rowH * 0.4,
      fontFace: FONT_FACE,
      fontSize: 8,
      color: MUTED,
      align: "right",
    });
    if (i < costs.length - 1) {
      s1.addShape(pres.ShapeType.line, {
        x: listX + 0.28,
        y: rowTop + rowH,
        w: listW - 0.32,
        h: 0,
        line: { color: ACCENT_SOFT, width: 0.5 },
      });
    }
  });

  // ===== Slide 2 — Services =====
  const s2 = pres.addSlide({ masterName: "DECK_BASE" });
  addLogo(s2);
  s2.addText("OUR SERVICES", {
    x: innerX,
    y: innerY + 0.9,
    w: 9,
    h: 0.85,
    fontFace: FONT_FACE,
    fontSize: 36,
    bold: true,
    color: INK,
  });
  s2.addText(
    [
      { text: "WE CHARGE A ", options: { color: INK, bold: true } },
      {
        text: `${data.managementFeePct}% MANAGEMENT FEE + VAT`,
        options: { color: ACCENT, bold: true },
      },
      { text: " ON THE REVENUE", options: { color: INK, bold: true } },
    ],
    {
      x: innerX,
      y: innerY + 1.7,
      w: innerW - 0.2,
      h: 0.4,
      fontFace: FONT_FACE,
      fontSize: 14,
    },
  );
  s2.addText("GENERATED FOR YOUR PROPERTY.", {
    x: innerX,
    y: innerY + 2.05,
    w: innerW - 0.2,
    h: 0.4,
    fontFace: FONT_FACE,
    fontSize: 14,
    bold: true,
    color: INK,
  });

  const cards = [
    { title: "LISTING MANAGEMENT", bullets: splitBullets(data.listingMgmtBullets) },
    { title: "GUEST MANAGEMENT", bullets: splitBullets(data.guestMgmtBullets) },
    { title: "PROPERTY MANAGEMENT", bullets: splitBullets(data.propertyMgmtBullets) },
  ];
  const cardsTop = innerY + 2.7;
  const cardsW = (innerW - 0.5) / 3;
  cards.forEach((c, i) => {
    const x = innerX + i * (cardsW + 0.25);
    // Pink pill header
    s2.addShape(pres.ShapeType.roundRect, {
      x,
      y: cardsTop,
      w: cardsW,
      h: 0.55,
      fill: { color: ACCENT },
      line: { color: ACCENT },
      rectRadius: 0.1,
    });
    s2.addText(c.title, {
      x: x + 0.2,
      y: cardsTop,
      w: cardsW - 0.4,
      h: 0.55,
      fontFace: FONT_FACE,
      fontSize: 12,
      bold: true,
      color: "FFFFFF",
      valign: "middle",
    });
    // Gray body
    const bodyTop = cardsTop + 0.65;
    const bodyH = innerH - (bodyTop - innerY) - 0.2;
    s2.addShape(pres.ShapeType.roundRect, {
      x,
      y: bodyTop,
      w: cardsW,
      h: bodyH,
      fill: { color: CARD_GRAY },
      line: { color: CARD_GRAY },
      rectRadius: 0.1,
    });
    s2.addText(
      c.bullets.map((t) => ({
        text: t,
        options: { bullet: { code: "25CF" }, bold: true, color: "1E2530" },
      })),
      {
        x: x + 0.35,
        y: bodyTop + 0.25,
        w: cardsW - 0.5,
        h: bodyH - 0.4,
        fontFace: FONT_FACE,
        fontSize: 12,
        valign: "top",
        paraSpaceAfter: 8,
      },
    );
  });

  // ===== Slide 3 — About (3-column layout) =====
  const s3 = pres.addSlide({ masterName: "DECK_BASE" });
  addLogo(s3);
  s3.addText("ABOUT US", {
    x: innerX,
    y: innerY + 0.9,
    w: 5,
    h: 0.9,
    fontFace: FONT_FACE,
    fontSize: 36,
    bold: true,
    color: INK,
  });

  // Column geometry — three vertical bands.
  const colLeftX = innerX;
  const colLeftW = 3.6;
  const colMidX = innerX + 3.8;
  const colMidW = 5.8;
  const colRightX = innerX + 9.8;
  const colRightW = innerW - (colRightX - innerX) - 0.1;

  // --- Left column: illustration ---
  // Rasterize the SVG to PNG before embedding. Mobile PowerPoint /
  // Keynote viewers can't render SVG inside pptx, so they'd show a
  // broken/missing image. PNG is universally supported.
  const aboutIllSize = Math.min(colLeftW, 3.5);
  const aboutPngPx = 720; // ~96dpi × 7.5in display target → crisp on retina too
  const aboutPng = await svgToPng(ABOUT_SVG, aboutPngPx, aboutPngPx);
  s3.addImage({
    data: aboutPng,
    x: colLeftX + (colLeftW - aboutIllSize) / 2,
    y: innerY + 1.9,
    w: aboutIllSize,
    h: aboutIllSize,
  });

  // --- Middle column: intro paragraph + reasons ---
  s3.addText(data.aboutText, {
    x: colMidX,
    y: innerY + 1.6,
    w: colMidW,
    h: 1.1,
    fontFace: FONT_FACE,
    fontSize: 13,
    bold: true,
    color: INK,
    valign: "top",
  });

  const reasons: Array<{ title: string; body: string }> = [
    { title: "MORE REVENUE", body: "10–15% more income than long-term contracts." },
    { title: "NO COMMITMENT", body: "No long-term commitment with tenants." },
    { title: "FLEXIBILITY", body: "Sell your property whenever you want." },
    { title: "EASY MANAGEMENT", body: "Hassle-free management end-to-end." },
    { title: "FREEDOM TO USE", body: "Block your own dates whenever you need." },
    { title: "LESS FLUCTUATION", body: "Optimise revenue based on seasonality." },
    { title: "CAPITAL GAINS", body: "Higher sales price than long-term rentals." },
  ];
  const reasonsRowH = 0.5;
  const reasonsY = innerY + 2.8;
  reasons.forEach((r, i) => {
    const y = reasonsY + i * reasonsRowH;
    s3.addShape(pres.ShapeType.ellipse, {
      x: colMidX,
      y: y + 0.07,
      w: 0.12,
      h: 0.12,
      fill: { color: ACCENT },
      line: { color: ACCENT },
    });
    s3.addText(r.title, {
      x: colMidX + 0.22,
      y,
      w: colMidW - 0.22,
      h: 0.24,
      fontFace: FONT_FACE,
      fontSize: 11,
      bold: true,
      color: ACCENT,
    });
    s3.addText(r.body, {
      x: colMidX + 0.22,
      y: y + 0.22,
      w: colMidW - 0.22,
      h: 0.22,
      fontFace: FONT_FACE,
      fontSize: 9.5,
      color: INK,
    });
  });

  // --- Right column: contact info stacked ---
  s3.addText("CONTACT", {
    x: colRightX,
    y: innerY + 1.6,
    w: colRightW,
    h: 0.3,
    fontFace: FONT_FACE,
    fontSize: 11,
    bold: true,
    color: MUTED,
  });
  s3.addShape(pres.ShapeType.line, {
    x: colRightX,
    y: innerY + 1.9,
    w: 0.55,
    h: 0,
    line: { color: ACCENT, width: 1.5 },
  });

  const contactItems: Array<{ label: string; value: string | null | undefined }> = [
    { label: "CALL", value: brand.phone },
    { label: "EMAIL", value: brand.email },
    { label: "WEB", value: brand.website },
  ];
  let contactY = innerY + 2.1;
  const contactRowH = 0.85;
  contactItems.forEach((item) => {
    if (!item.value) return;
    s3.addShape(pres.ShapeType.ellipse, {
      x: colRightX,
      y: contactY + 0.07,
      w: 0.12,
      h: 0.12,
      fill: { color: ACCENT },
      line: { color: ACCENT },
    });
    s3.addText(item.label, {
      x: colRightX + 0.22,
      y: contactY,
      w: colRightW - 0.22,
      h: 0.24,
      fontFace: FONT_FACE,
      fontSize: 9,
      bold: true,
      color: ACCENT,
    });
    s3.addText(item.value, {
      x: colRightX + 0.22,
      y: contactY + 0.25,
      w: colRightW - 0.22,
      h: 0.45,
      fontFace: FONT_FACE,
      fontSize: 11,
      bold: true,
      color: INK,
      valign: "top",
    });
    contactY += contactRowH;
  });

  // ===== Slide 4 — Financial breakdown =====
  const s4 = pres.addSlide({ masterName: "DECK_BASE" });
  addLogo(s4);
  s4.addText("FINANCIAL BREAKDOWN", {
    x: innerX,
    y: innerY + 0.9,
    w: 10,
    h: 0.85,
    fontFace: FONT_FACE,
    fontSize: 32,
    bold: true,
    color: INK,
  });

  const p = computeScenario(data.pessimisticNet, data);
  const r = computeScenario(data.realisticNet, data);
  const o = computeScenario(data.optimisticNet, data);
  const duYear = data.duMonthly * 12;
  const dewaYear = data.dewaChillerMonthly * 12;
  const maintenanceYear = data.maintenanceMonthly * 12;

  const cell = (
    text: string,
    opts: Partial<{
      bold: boolean;
      color: string;
      fill: string;
      align: "left" | "center" | "right";
    }> = {},
  ): PptxGenJSType.TableCell => ({
    text,
    options: {
      bold: !!opts.bold,
      color: opts.color ?? INK,
      fill: opts.fill ? { color: opts.fill } : undefined,
      align: opts.align ?? "left",
      valign: "middle",
      fontSize: 11,
      fontFace: FONT_FACE,
    },
  });

  const rows: PptxGenJSType.TableRow[] = [
    [
      cell("Scenario", { bold: true, color: "FFFFFF", fill: "8C8C8C", align: "left" }),
      cell("Pessimistic", { bold: true, color: "FFFFFF", fill: "C14041", align: "center" }),
      cell("Realistic", { bold: true, color: "FFFFFF", fill: "71A8C7", align: "center" }),
      cell("Optimistic", { bold: true, color: "FFFFFF", fill: "89BC60", align: "center" }),
    ],
    [
      cell("Occupancy rate"),
      cell(`${data.pessimisticOccupancy}%`, { align: "right" }),
      cell(`${data.realisticOccupancy}%`, { align: "right" }),
      cell(`${data.optimisticOccupancy}%`, { align: "right" }),
    ],
    [
      cell("Gross annual revenue", { bold: true }),
      cell(fmt(p.gross), { bold: true, align: "right" }),
      cell(fmt(r.gross), { bold: true, align: "right" }),
      cell(fmt(o.gross), { bold: true, align: "right" }),
    ],
    [
      cell("Portal fees (Booking, Airbnb…)"),
      cell(fmt(p.portal), { align: "right" }),
      cell(fmt(r.portal), { align: "right" }),
      cell(fmt(o.portal), { align: "right" }),
    ],
    [
      cell("Du (Internet)"),
      cell(fmt(duYear), { align: "right" }),
      cell(fmt(duYear), { align: "right" }),
      cell(fmt(duYear), { align: "right" }),
    ],
    [
      cell("DEWA + Chiller"),
      cell(fmt(dewaYear), { align: "right" }),
      cell(fmt(dewaYear), { align: "right" }),
      cell(fmt(dewaYear), { align: "right" }),
    ],
    [
      cell("Property insurance"),
      cell(fmt(data.propertyInsuranceYearly), { align: "right" }),
      cell(fmt(data.propertyInsuranceYearly), { align: "right" }),
      cell(fmt(data.propertyInsuranceYearly), { align: "right" }),
    ],
    [
      cell("DTCM registration"),
      cell(fmt(data.dtcmPermitYearly), { align: "right" }),
      cell(fmt(data.dtcmPermitYearly), { align: "right" }),
      cell(fmt(data.dtcmPermitYearly), { align: "right" }),
    ],
    [
      cell("Maintenance and wear & tear"),
      cell(fmt(maintenanceYear), { align: "right" }),
      cell(fmt(maintenanceYear), { align: "right" }),
      cell(fmt(maintenanceYear), { align: "right" }),
    ],
    [
      cell("Management fee"),
      cell(fmt(p.managementFee), { align: "right" }),
      cell(fmt(r.managementFee), { align: "right" }),
      cell(fmt(o.managementFee), { align: "right" }),
    ],
    [
      cell("VAT"),
      cell(fmt(p.vat), { align: "right" }),
      cell(fmt(r.vat), { align: "right" }),
      cell(fmt(o.vat), { align: "right" }),
    ],
    [
      cell("Total operating expenses", { bold: true, fill: "DCDCDC" }),
      cell(fmt(p.totalExpenses), { bold: true, fill: "DCDCDC", align: "right" }),
      cell(fmt(r.totalExpenses), { bold: true, fill: "DCDCDC", align: "right" }),
      cell(fmt(o.totalExpenses), { bold: true, fill: "DCDCDC", align: "right" }),
    ],
    [
      cell("Net annual income", { bold: true, color: "FFFFFF", fill: ACCENT }),
      cell(fmt(p.net), { bold: true, color: "FFFFFF", fill: ACCENT, align: "right" }),
      cell(fmt(r.net), { bold: true, color: "FFFFFF", fill: ACCENT, align: "right" }),
      cell(fmt(o.net), { bold: true, color: "FFFFFF", fill: ACCENT, align: "right" }),
    ],
  ];

  s4.addTable(rows, {
    x: innerX,
    y: innerY + 1.9,
    w: innerW,
    fontFace: FONT_FACE,
    fontSize: 11,
    border: { type: "solid", color: BORDER, pt: 0.5 },
    colW: [4.3, 2.667, 2.667, 2.666],
  });

  const safeName = safeFile(
    `${data.buildingName || data.propertyName}-projection`,
  );
  await pres.writeFile({ fileName: `${safeName}.pptx` });
}
