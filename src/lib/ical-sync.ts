import nodeIcal from "node-ical";
import { prisma } from "./prisma";

export type SyncOutcome = {
  propertyId: string;
  propertyName: string;
  ok: boolean;
  created: number;
  updated: number;
  skipped: number;
  error?: string;
};

function nightsBetween(checkIn: Date, checkOut: Date) {
  const ms = checkOut.getTime() - checkIn.getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function parseGuestName(summary: string | undefined, description: string | undefined) {
  if (!summary) return null;
  const cleaned = summary.replace(/^Reserved\s*-?\s*/i, "").trim();
  if (cleaned && cleaned.toLowerCase() !== "airbnb (not available)" && cleaned.toLowerCase() !== "not available") {
    return cleaned;
  }
  if (description) {
    const m = description.match(/Guest:\s*([^\n]+)/i);
    if (m) return m[1].trim();
  }
  return null;
}

function isBlocked(summary: string | undefined) {
  if (!summary) return false;
  const s = summary.toLowerCase();
  return s.includes("not available") || s.includes("blocked");
}

export async function syncProperty(propertyId: string): Promise<SyncOutcome> {
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) return { propertyId, propertyName: "?", ok: false, created: 0, updated: 0, skipped: 0, error: "Property not found" };
  if (!property.airbnbIcalUrl) {
    return { propertyId, propertyName: property.name, ok: false, created: 0, updated: 0, skipped: 0, error: "No iCal URL set" };
  }

  const outcome: SyncOutcome = {
    propertyId,
    propertyName: property.name,
    ok: true,
    created: 0,
    updated: 0,
    skipped: 0,
  };

  try {
    const events = await nodeIcal.async.fromURL(property.airbnbIcalUrl);
    for (const key of Object.keys(events)) {
      const ev = events[key] as nodeIcal.VEvent;
      if (!ev || ev.type !== "VEVENT") continue;
      if (!ev.start || !ev.end) continue;
      const checkIn = new Date(ev.start as Date);
      const checkOut = new Date(ev.end as Date);
      if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) continue;
      if (isBlocked(ev.summary as string | undefined)) {
        outcome.skipped++;
        continue;
      }
      const externalId = (ev.uid as string) || `${ev.start}-${ev.end}`;
      const guest = parseGuestName(ev.summary as string | undefined, ev.description as string | undefined);
      const nights = nightsBetween(checkIn, checkOut);
      const existing = await prisma.reservation.findUnique({
        where: { propertyId_externalId: { propertyId, externalId } },
      });
      if (existing) {
        await prisma.reservation.update({
          where: { id: existing.id },
          data: {
            checkIn,
            checkOut,
            nights,
            guestName: existing.detailsFilled ? existing.guestName : guest,
            rawSummary: (ev.summary as string) || null,
            rawDescription: (ev.description as string) || null,
            syncedAt: new Date(),
          },
        });
        outcome.updated++;
      } else {
        const fallbackTotal = property.basePrice * nights + property.cleaningFee;
        await prisma.reservation.create({
          data: {
            propertyId,
            externalId,
            source: "airbnb",
            status: "CONFIRMED",
            guestName: guest,
            checkIn,
            checkOut,
            nights,
            pricePerNight: property.basePrice,
            totalPrice: fallbackTotal,
            cleaningFee: property.cleaningFee,
            payout: fallbackTotal,
            currency: "AED",
            rawSummary: (ev.summary as string) || null,
            rawDescription: (ev.description as string) || null,
            detailsFilled: false,
          },
        });
        outcome.created++;
      }
    }
    await prisma.property.update({
      where: { id: propertyId },
      data: { lastSyncedAt: new Date() },
    });
  } catch (err) {
    outcome.ok = false;
    outcome.error = (err as Error).message;
  }
  return outcome;
}

export async function syncProperties(propertyIds?: string[]) {
  const props = await prisma.property.findMany({
    where: propertyIds ? { id: { in: propertyIds } } : { airbnbIcalUrl: { not: null } },
    select: { id: true },
  });
  const results: SyncOutcome[] = [];
  for (const p of props) {
    results.push(await syncProperty(p.id));
  }
  return results;
}
