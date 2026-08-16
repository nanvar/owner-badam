"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

// One flat row of the reservations export. Extensions reuse the same
// shape as their parent booking so the spreadsheet reads as a single
// chronological ledger — `kind` tells the two apart and the extension
// inherits property / guest / booking ref from its parent.
export type ReservationExportRow = {
  kind: "reservation" | "extension";
  propertyName: string;
  ownerName: string | null;
  bookingRef: string | null;
  source: string;
  status: string;
  guestName: string | null;
  guestPhone: string | null;
  guestEmail: string | null;
  numGuests: number | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  pricePerNight: number;
  cleaningFee: number;
  agencyCommission: number;
  portalCommission: number;
  serviceFee: number;
  taxes: number;
  totalPrice: number;
  payout: number;
  currency: string;
  paid: boolean;
  monthKey: string | null;
  reported: boolean;
  notes: string | null;
};

// Every reservation ever recorded — no month filter, no report filter —
// each immediately followed by its extensions. The list view hides
// reported rows and filters by billing month; the export deliberately
// does not, because it's meant as the full archive.
export async function listReservationsForExportAction(): Promise<
  ReservationExportRow[]
> {
  await requireRole("ADMIN");
  const reservations = await prisma.reservation.findMany({
    include: {
      property: {
        select: { name: true, owner: { select: { name: true } } },
      },
      extensions: { orderBy: { checkIn: "asc" } },
    },
    orderBy: [{ checkIn: "desc" }],
  });

  const rows: ReservationExportRow[] = [];
  for (const r of reservations) {
    const propertyName = r.property.name;
    const ownerName = r.property.owner.name;
    rows.push({
      kind: "reservation",
      propertyName,
      ownerName,
      bookingRef: r.externalId,
      source: r.source,
      status: r.status,
      guestName: r.guestName,
      guestPhone: r.guestPhone,
      guestEmail: r.guestEmail,
      numGuests: r.numGuests,
      checkIn: r.checkIn.toISOString(),
      checkOut: r.checkOut.toISOString(),
      nights: r.nights,
      pricePerNight: r.pricePerNight,
      cleaningFee: r.cleaningFee,
      agencyCommission: r.agencyCommission,
      portalCommission: r.portalCommission,
      serviceFee: r.serviceFee,
      taxes: r.taxes,
      totalPrice: r.totalPrice,
      payout: r.payout,
      currency: r.currency,
      paid: r.paid,
      monthKey: r.monthKey,
      reported: r.reportId != null,
      notes: r.notes,
    });
    for (const e of r.extensions) {
      rows.push({
        kind: "extension",
        propertyName,
        ownerName,
        bookingRef: r.externalId,
        source: r.source,
        status: r.status,
        guestName: r.guestName,
        guestPhone: r.guestPhone,
        guestEmail: r.guestEmail,
        numGuests: r.numGuests,
        checkIn: e.checkIn.toISOString(),
        checkOut: e.checkOut.toISOString(),
        nights: e.nights,
        // Extensions store a lump total; per-night is derived the same
        // way the list view derives it.
        pricePerNight: e.nights > 0 ? e.totalPrice / e.nights : 0,
        cleaningFee: 0,
        agencyCommission: e.agencyCommission,
        portalCommission: e.portalCommission,
        serviceFee: 0,
        taxes: 0,
        totalPrice: e.totalPrice,
        payout: e.payout,
        currency: e.currency,
        paid: e.paid,
        monthKey: e.monthKey,
        reported: e.reportId != null,
        notes: e.notes,
      });
    }
  }
  return rows;
}
