// Native iCal parser — no external deps. Airbnb's iCal feed is a tiny
// subset of RFC 5545 (only VEVENT blocks with DTSTART/DTEND/SUMMARY/UID/
// DESCRIPTION), so a ~50-line parser is reliable enough and avoids pulling
// in node-ical + temporal-polyfill + their native bindings on prod.
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

type IcsEvent = {
  uid: string | null;
  summary: string | null;
  description: string | null;
  start: Date | null;
  end: Date | null;
};

// Parse a YYYYMMDD or YYYYMMDDTHHMMSS(Z) string from a DTSTART/DTEND value.
// Airbnb uses VALUE=DATE (date-only) for blocked + reserved blocks.
function parseIcsDate(value: string): Date | null {
  const trimmed = value.trim();
  // Date-only: 20260501
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(trimmed);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  }
  // Datetime: 20260501T120000(Z)
  const datetime = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(
    trimmed,
  );
  if (datetime) {
    const [, y, m, d, hh, mm, ss] = datetime;
    return new Date(
      Date.UTC(
        Number(y),
        Number(m) - 1,
        Number(d),
        Number(hh),
        Number(mm),
        Number(ss),
      ),
    );
  }
  return null;
}

// Unfold RFC 5545 line continuations (a line that begins with a single space
// or tab is a continuation of the previous line).
function unfoldLines(text: string): string[] {
  const raw = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function parseIcs(text: string): IcsEvent[] {
  const events: IcsEvent[] = [];
  let current: IcsEvent | null = null;
  for (const line of unfoldLines(text)) {
    if (line === "BEGIN:VEVENT") {
      current = {
        uid: null,
        summary: null,
        description: null,
        start: null,
        end: null,
      };
      continue;
    }
    if (line === "END:VEVENT") {
      if (current) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;

    // Split "PROPERTY[;PARAMS...]:VALUE"
    const colonIdx = line.indexOf(":");
    if (colonIdx <= 0) continue;
    const head = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);
    const propName = head.split(";")[0].toUpperCase();

    switch (propName) {
      case "UID":
        current.uid = value;
        break;
      case "SUMMARY":
        // Unescape RFC 5545 text escapes.
        current.summary = value
          .replace(/\\n/g, "\n")
          .replace(/\\,/g, ",")
          .replace(/\\;/g, ";")
          .replace(/\\\\/g, "\\");
        break;
      case "DESCRIPTION":
        current.description = value
          .replace(/\\n/g, "\n")
          .replace(/\\,/g, ",")
          .replace(/\\;/g, ";")
          .replace(/\\\\/g, "\\");
        break;
      case "DTSTART":
        current.start = parseIcsDate(value);
        break;
      case "DTEND":
        current.end = parseIcsDate(value);
        break;
    }
  }
  return events;
}

function nightsBetween(checkIn: Date, checkOut: Date) {
  const ms = checkOut.getTime() - checkIn.getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function parseGuestName(
  summary: string | null,
  description: string | null,
): string | null {
  if (summary) {
    const cleaned = summary.replace(/^Reserved\s*-?\s*/i, "").trim();
    const lower = cleaned.toLowerCase();
    if (
      cleaned &&
      lower !== "airbnb (not available)" &&
      lower !== "not available" &&
      lower !== "reserved"
    ) {
      return cleaned;
    }
  }
  if (description) {
    const m = description.match(/Guest:\s*([^\n]+)/i);
    if (m) return m[1].trim();
  }
  return null;
}

function isBlocked(summary: string | null) {
  if (!summary) return false;
  const s = summary.toLowerCase();
  return s.includes("not available") || s.includes("blocked");
}

export async function syncProperty(propertyId: string): Promise<SyncOutcome> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
  });
  if (!property) {
    return {
      propertyId,
      propertyName: "?",
      ok: false,
      created: 0,
      updated: 0,
      skipped: 0,
      error: "Property not found",
    };
  }
  if (!property.airbnbIcalUrl) {
    return {
      propertyId,
      propertyName: property.name,
      ok: false,
      created: 0,
      updated: 0,
      skipped: 0,
      error: "No iCal URL set",
    };
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
    const res = await fetch(property.airbnbIcalUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; BadamOwners/1.0; +https://badam.ae)",
        Accept: "text/calendar, text/plain, */*;q=0.1",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Feed returned HTTP ${res.status}`);
    }
    const ics = await res.text();
    const events = parseIcs(ics);

    for (const ev of events) {
      if (!ev.start || !ev.end) continue;
      if (isBlocked(ev.summary)) {
        outcome.skipped++;
        continue;
      }
      const externalId =
        ev.uid ?? `${ev.start.toISOString()}-${ev.end.toISOString()}`;
      const guest = parseGuestName(ev.summary, ev.description);
      const nights = nightsBetween(ev.start, ev.end);
      const existing = await prisma.reservation.findUnique({
        where: { propertyId_externalId: { propertyId, externalId } },
      });
      if (existing) {
        await prisma.reservation.update({
          where: { id: existing.id },
          data: {
            checkIn: ev.start,
            checkOut: ev.end,
            nights,
            guestName: existing.detailsFilled ? existing.guestName : guest,
            rawSummary: ev.summary,
            rawDescription: ev.description,
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
            checkIn: ev.start,
            checkOut: ev.end,
            nights,
            pricePerNight: property.basePrice,
            totalPrice: fallbackTotal,
            cleaningFee: property.cleaningFee,
            payout: fallbackTotal,
            currency: "AED",
            rawSummary: ev.summary,
            rawDescription: ev.description,
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
    console.error("[sync] property=%s error:", property.name, err);
  }
  console.log(
    "[sync] %s → created=%d updated=%d skipped=%d ok=%s",
    property.name,
    outcome.created,
    outcome.updated,
    outcome.skipped,
    outcome.ok,
  );
  return outcome;
}

export async function syncProperties(propertyIds?: string[]) {
  const props = await prisma.property.findMany({
    where: propertyIds
      ? { id: { in: propertyIds } }
      : { airbnbIcalUrl: { not: null } },
    select: { id: true },
  });
  const results: SyncOutcome[] = [];
  for (const p of props) {
    results.push(await syncProperty(p.id));
  }
  return results;
}
