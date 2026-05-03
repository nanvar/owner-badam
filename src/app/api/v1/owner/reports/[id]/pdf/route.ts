import { prisma } from "@/lib/prisma";
import { requireOwnerApi, jsonError } from "@/lib/api-auth";
import { getSettings } from "@/lib/settings";
import { buildReportPdf, type ReportPdfInput } from "@/lib/report-pdf";

async function fetchLogoAsDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get("content-type") || "image/png";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireOwnerApi(req);
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;

  const [report, settings, ownerProfile] = await Promise.all([
    prisma.ownerReport.findUnique({
      where: { id },
      include: {
        property: { select: { name: true, color: true } },
        reservations: { orderBy: { checkIn: "asc" } },
        expenses: { orderBy: { date: "asc" } },
      },
    }),
    getSettings(),
    prisma.user.findUnique({
      where: { id: auth.session.userId },
      select: {
        name: true,
        email: true,
        phone: true,
        taxId: true,
        address: true,
      },
    }),
  ]);
  if (!report || report.ownerId !== auth.session.userId) {
    return jsonError("not found", 404);
  }

  const input: ReportPdfInput = {
    name: report.name,
    notes: report.notes,
    createdAt: report.createdAt.toISOString(),
    property: { name: report.property.name },
    owner: {
      name: ownerProfile?.name ?? ownerProfile?.email ?? "",
      email: ownerProfile?.email ?? "",
      phone: ownerProfile?.phone ?? null,
      taxId: ownerProfile?.taxId ?? null,
      address: ownerProfile?.address ?? null,
    },
    reservations: report.reservations.map((r) => ({
      checkIn: r.checkIn.toISOString(),
      checkOut: r.checkOut.toISOString(),
      nights: r.nights,
      guestName: r.guestName,
      totalPrice: r.totalPrice,
      payout: r.payout,
      currency: r.currency,
    })),
    expenses: report.expenses.map((e) => ({
      date: e.date.toISOString(),
      type: e.type,
      description: e.description,
      amount: e.amount,
    })),
    totals: {
      income: report.totalIncome,
      expenses: report.totalExpenses,
      net: report.netPayout,
    },
    brand: {
      name: settings.brandName,
      legalName: settings.legalName,
      logoDataUrl: await fetchLogoAsDataUrl(settings.logoUrl),
      address:
        [settings.address, settings.city, settings.country]
          .filter(Boolean)
          .join(", ") || null,
      email: settings.email,
      phone: settings.phone,
      website: settings.website,
    },
  };

  const buf = await buildReportPdf(input);
  const safeName = `${report.property.name}-${report.name}`
    .replace(/[^\w\d\-_. ]+/g, "")
    .trim();
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${safeName}.pdf"`,
    },
  });
}
