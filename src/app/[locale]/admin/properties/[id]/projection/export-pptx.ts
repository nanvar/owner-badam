"use client";

import type PptxGenJSType from "pptxgenjs";
import {
  computeScenario,
  type ProjectionBrand,
  type ProjectionData,
} from "./projection-editor";

const BRAND_DARK = "2F5A47";
const BRAND_ACCENT = "C44B6E";
const BRAND_SOFT = "F3F7F4";
const INK = "1E2328";
const MUTED = "6E747A";
const BORDER = "D9E0DC";

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
  pres.defineLayout({ name: "BADAM_WIDE", width: 13.333, height: 7.5 });
  pres.layout = "BADAM_WIDE";
  pres.title = `${brand.name} — ${data.buildingName || data.propertyName}`;
  pres.author = brand.legalName || brand.name;

  // === Master with top/bottom bars + footer (applies to all slides) ===
  pres.defineSlideMaster({
    title: "BADAM_BASE",
    background: { color: "FFFFFF" },
    objects: [
      { rect: { x: 0, y: 0, w: 13.333, h: 0.08, fill: { color: BRAND_DARK } } },
      {
        rect: {
          x: 0,
          y: 7.22,
          w: 13.333,
          h: 0.28,
          fill: { color: BRAND_SOFT },
        },
      },
      {
        text: {
          text: brand.email ?? "",
          options: {
            x: 0.4,
            y: 7.22,
            w: 4,
            h: 0.28,
            fontFace: "Helvetica",
            fontSize: 8,
            color: MUTED,
            valign: "middle",
          },
        },
      },
      {
        text: {
          text: brand.phone ?? "",
          options: {
            x: 4.6,
            y: 7.22,
            w: 4,
            h: 0.28,
            fontFace: "Helvetica",
            fontSize: 8,
            color: MUTED,
            align: "center",
            valign: "middle",
          },
        },
      },
      {
        text: {
          text: brand.name,
          options: {
            x: 8.6,
            y: 7.22,
            w: 4.3,
            h: 0.28,
            fontFace: "Helvetica",
            fontSize: 8,
            color: MUTED,
            align: "right",
            valign: "middle",
          },
        },
      },
    ],
  });

  const addLogo = (s: PptxGenJSType.Slide) => {
    if (!brand.logoDataUrl) {
      s.addText(brand.name, {
        x: 0.4,
        y: 0.25,
        w: 4,
        h: 0.45,
        fontFace: "Helvetica",
        fontSize: 16,
        bold: true,
        color: INK,
      });
      return;
    }
    s.addImage({
      data: brand.logoDataUrl,
      x: 0.4,
      y: 0.25,
      w: 1.6,
      h: 0.5,
      sizing: { type: "contain", w: 1.6, h: 0.5 },
    });
  };

  // ===== Slide 1 — Hero =====
  const s1 = pres.addSlide({ masterName: "BADAM_BASE" });
  addLogo(s1);
  s1.addText("YOU COULD EARN", {
    x: 0.4,
    y: 1.2,
    w: 7,
    h: 0.6,
    fontFace: "Helvetica",
    fontSize: 36,
    bold: true,
    color: INK,
  });
  s1.addText(
    `AED ${data.avgMonthlyNet.toLocaleString("en-GB", { maximumFractionDigits: 0 })} NET`,
    {
      x: 0.4,
      y: 1.85,
      w: 7,
      h: 0.6,
      fontFace: "Helvetica",
      fontSize: 32,
      bold: true,
      color: BRAND_ACCENT,
    },
  );
  s1.addText("on average per month for your property", {
    x: 0.4,
    y: 2.5,
    w: 7,
    h: 0.45,
    fontFace: "Helvetica",
    fontSize: 18,
    color: INK,
  });

  const meta: Array<{ label: string; value: string }> = [
    { label: "AREA", value: data.area || "—" },
    { label: "BUILDING", value: data.buildingName || data.propertyName },
    {
      label: "BEDROOMS",
      value:
        data.bedrooms === 1 ? "1 BEDROOM" : `${data.bedrooms} BEDROOMS`,
    },
  ];
  meta.forEach((m, i) => {
    const y = 3.6 + i * 0.85;
    s1.addText(m.label, {
      x: 0.4,
      y,
      w: 3,
      h: 0.25,
      fontFace: "Helvetica",
      fontSize: 11,
      bold: true,
      color: BRAND_ACCENT,
    });
    s1.addShape(pres.ShapeType.line, {
      x: 0.4,
      y: y + 0.25,
      w: 1,
      h: 0,
      line: { color: BRAND_ACCENT, width: 1 },
    });
    s1.addText(m.value.toUpperCase(), {
      x: 0.4,
      y: y + 0.3,
      w: 4,
      h: 0.3,
      fontFace: "Helvetica",
      fontSize: 13,
      bold: true,
      color: INK,
    });
  });

  s1.addText("EXPECTED MONTHLY COSTS", {
    x: 7.8,
    y: 1.2,
    w: 5,
    h: 0.45,
    fontFace: "Helvetica",
    fontSize: 18,
    bold: true,
    color: BRAND_ACCENT,
  });
  s1.addShape(pres.ShapeType.roundRect, {
    x: 7.8,
    y: 1.8,
    w: 5.2,
    h: 4.6,
    fill: { color: BRAND_SOFT },
    line: { color: BORDER },
    rectRadius: 0.18,
  });
  const costs: Array<{ label: string; value: string; sub: string }> = [
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
    const y = 2 + i * 0.85;
    s1.addText(c.label, {
      x: 8.05,
      y,
      w: 3,
      h: 0.4,
      fontFace: "Helvetica",
      fontSize: 11,
      color: MUTED,
    });
    s1.addText(c.value, {
      x: 11,
      y,
      w: 1.85,
      h: 0.4,
      fontFace: "Helvetica",
      fontSize: 14,
      bold: true,
      color: BRAND_ACCENT,
      align: "right",
    });
    s1.addText(c.sub, {
      x: 11,
      y: y + 0.32,
      w: 1.85,
      h: 0.25,
      fontFace: "Helvetica",
      fontSize: 8,
      color: MUTED,
      align: "right",
    });
  });

  // ===== Slide 2 — Services =====
  const s2 = pres.addSlide({ masterName: "BADAM_BASE" });
  addLogo(s2);
  s2.addText("OUR SERVICES", {
    x: 0.4,
    y: 0.9,
    w: 7,
    h: 0.55,
    fontFace: "Helvetica",
    fontSize: 28,
    bold: true,
    color: INK,
  });
  s2.addText(
    [
      { text: "We charge a ", options: { color: INK } },
      {
        text: `${data.managementFeePct}% management fee + VAT`,
        options: { color: BRAND_ACCENT, bold: true },
      },
      {
        text: " on the revenue generated for your property.",
        options: { color: INK },
      },
    ],
    {
      x: 0.4,
      y: 1.5,
      w: 12,
      h: 0.4,
      fontFace: "Helvetica",
      fontSize: 13,
    },
  );

  const cols = [
    {
      title: "LISTING MANAGEMENT",
      bullets: splitBullets(data.listingMgmtBullets),
    },
    {
      title: "GUEST MANAGEMENT",
      bullets: splitBullets(data.guestMgmtBullets),
    },
    {
      title: "PROPERTY MANAGEMENT",
      bullets: splitBullets(data.propertyMgmtBullets),
    },
  ];
  const colW = 4;
  const startX = 0.6;
  const gap = 0.3;
  cols.forEach((c, i) => {
    const x = startX + i * (colW + gap);
    s2.addShape(pres.ShapeType.roundRect, {
      x,
      y: 2.2,
      w: colW,
      h: 0.6,
      fill: { color: BRAND_ACCENT },
      line: { color: BRAND_ACCENT },
      rectRadius: 0.12,
    });
    s2.addText(c.title, {
      x: x + 0.15,
      y: 2.2,
      w: colW - 0.3,
      h: 0.6,
      fontFace: "Helvetica",
      fontSize: 12,
      bold: true,
      color: "FFFFFF",
      valign: "middle",
    });
    s2.addShape(pres.ShapeType.roundRect, {
      x,
      y: 2.95,
      w: colW,
      h: 3.9,
      fill: { color: BRAND_SOFT },
      line: { color: BORDER },
      rectRadius: 0.12,
    });
    s2.addText(
      c.bullets.map((t) => ({
        text: t,
        options: { bullet: { code: "25CF" } },
      })),
      {
        x: x + 0.25,
        y: 3.1,
        w: colW - 0.4,
        h: 3.6,
        fontFace: "Helvetica",
        fontSize: 11,
        color: INK,
        valign: "top",
        paraSpaceAfter: 6,
      },
    );
  });

  // ===== Slide 3 — About =====
  const s3 = pres.addSlide({ masterName: "BADAM_BASE" });
  addLogo(s3);
  s3.addText("ABOUT US", {
    x: 0.4,
    y: 1,
    w: 6,
    h: 0.7,
    fontFace: "Helvetica",
    fontSize: 32,
    bold: true,
    color: INK,
  });
  s3.addText(data.aboutText, {
    x: 0.4,
    y: 1.9,
    w: 7.5,
    h: 4,
    fontFace: "Helvetica",
    fontSize: 13,
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
  reasons.forEach((r, i) => {
    const y = 1.5 + i * 0.62;
    s3.addShape(pres.ShapeType.ellipse, {
      x: 8.7,
      y: y + 0.06,
      w: 0.12,
      h: 0.12,
      fill: { color: BRAND_ACCENT },
      line: { color: BRAND_ACCENT },
    });
    s3.addText(r.title, {
      x: 8.95,
      y,
      w: 4.2,
      h: 0.28,
      fontFace: "Helvetica",
      fontSize: 11,
      bold: true,
      color: BRAND_ACCENT,
    });
    s3.addText(r.body, {
      x: 8.95,
      y: y + 0.28,
      w: 4.2,
      h: 0.28,
      fontFace: "Helvetica",
      fontSize: 9,
      color: INK,
    });
  });

  // ===== Slide 4 — Financial breakdown =====
  const s4 = pres.addSlide({ masterName: "BADAM_BASE" });
  addLogo(s4);
  s4.addText("FINANCIAL BREAKDOWN", {
    x: 0.4,
    y: 0.9,
    w: 9,
    h: 0.55,
    fontFace: "Helvetica",
    fontSize: 26,
    bold: true,
    color: INK,
  });

  const p = computeScenario(data.pessimisticGross, data);
  const r = computeScenario(data.realisticGross, data);
  const o = computeScenario(data.optimisticGross, data);
  const duYear = data.duMonthly * 12;
  const dewaYear = data.dewaChillerMonthly * 12;
  const maintenanceYear = data.maintenanceMonthly * 12;

  const header = [
    { text: "", options: { fill: { color: BRAND_DARK }, color: "FFFFFF", bold: true } },
    {
      text: "Pessimistic",
      options: { fill: { color: BRAND_DARK }, color: "FFFFFF", bold: true, align: "center" as const },
    },
    {
      text: "Realistic",
      options: { fill: { color: BRAND_DARK }, color: "FFFFFF", bold: true, align: "center" as const },
    },
    {
      text: "Optimistic",
      options: { fill: { color: BRAND_DARK }, color: "FFFFFF", bold: true, align: "center" as const },
    },
  ];
  const row = (
    label: string,
    a: string,
    b: string,
    c: string,
    bold = false,
  ) => [
    { text: label, options: { bold, color: INK } },
    { text: a, options: { bold, align: "right" as const, color: INK } },
    { text: b, options: { bold, align: "right" as const, color: INK } },
    { text: c, options: { bold, align: "right" as const, color: INK } },
  ];
  const rows = [
    header,
    row(
      "Occupancy rate",
      `${data.pessimisticOccupancy}%`,
      `${data.realisticOccupancy}%`,
      `${data.optimisticOccupancy}%`,
    ),
    row(
      "Gross annual revenue",
      fmt(data.pessimisticGross),
      fmt(data.realisticGross),
      fmt(data.optimisticGross),
      true,
    ),
    row(
      "Portal fees (Booking, Airbnb…)",
      fmt(p.portal),
      fmt(r.portal),
      fmt(o.portal),
    ),
    row("Du (Internet)", fmt(duYear), fmt(duYear), fmt(duYear)),
    row("DEWA + Chiller", fmt(dewaYear), fmt(dewaYear), fmt(dewaYear)),
    row(
      "Property insurance",
      fmt(data.propertyInsuranceYearly),
      fmt(data.propertyInsuranceYearly),
      fmt(data.propertyInsuranceYearly),
    ),
    row(
      "DTCM registration",
      fmt(data.dtcmPermitYearly),
      fmt(data.dtcmPermitYearly),
      fmt(data.dtcmPermitYearly),
    ),
    row(
      "Maintenance and wear & tear",
      fmt(maintenanceYear),
      fmt(maintenanceYear),
      fmt(maintenanceYear),
    ),
    row(
      "Management fee",
      fmt(p.managementFee),
      fmt(r.managementFee),
      fmt(o.managementFee),
    ),
    row("VAT", fmt(p.vat), fmt(r.vat), fmt(o.vat)),
    row(
      "Total operating expenses",
      fmt(p.totalExpenses),
      fmt(r.totalExpenses),
      fmt(o.totalExpenses),
      true,
    ),
    [
      {
        text: "Net annual income",
        options: { bold: true, fill: { color: "4F8A6F" }, color: "FFFFFF" },
      },
      {
        text: fmt(p.net),
        options: {
          bold: true,
          fill: { color: "4F8A6F" },
          color: "FFFFFF",
          align: "right" as const,
        },
      },
      {
        text: fmt(r.net),
        options: {
          bold: true,
          fill: { color: "4F8A6F" },
          color: "FFFFFF",
          align: "right" as const,
        },
      },
      {
        text: fmt(o.net),
        options: {
          bold: true,
          fill: { color: "4F8A6F" },
          color: "FFFFFF",
          align: "right" as const,
        },
      },
    ],
  ];

  s4.addTable(rows, {
    x: 0.5,
    y: 1.7,
    w: 12.3,
    fontFace: "Helvetica",
    fontSize: 10,
    border: { type: "solid", color: BORDER, pt: 0.5 },
    colW: [4.3, 2.667, 2.667, 2.666],
  });

  const safeName = safeFile(
    `${data.buildingName || data.propertyName}-projection`,
  );
  await pres.writeFile({ fileName: `${safeName}.pptx` });
}
