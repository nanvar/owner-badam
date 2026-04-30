"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requireRole } from "@/lib/auth";

export type CrawlState =
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

// JSON-LD shape we care about — Airbnb publishes a Schema.org `Apartment` /
// `LodgingBusiness` blob inside `<script type="application/ld+json">` for SEO.
// Useful for description + occupancy. Amenities and full photo list live in
// the Apollo deferred state below.
type JsonLd = {
  description?: unknown;
  image?: unknown;
  occupancy?: { maxValue?: unknown };
  amenityFeature?: unknown;
  numberOfRooms?: unknown;
};

function parseJsonLd(html: string): JsonLd | null {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let best: JsonLd | null = null;
  let bestLen = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    if (raw.length <= bestLen) continue;
    try {
      const parsed = JSON.parse(raw);
      best = parsed;
      bestLen = raw.length;
    } catch {
      // ignore — sometimes the block is HTML-escaped with &quot; etc.
    }
  }
  return best;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// Extract the listing's room ID from URLs like
//   https://www.airbnb.com/rooms/1665791008762320061?...
function getRoomId(airbnbUrl: string): string | null {
  const m = airbnbUrl.match(/\/rooms\/(\d+)/);
  return m ? m[1] : null;
}

// Pull only photos that belong to THIS listing. Airbnb embeds three kinds of
// muscache URLs on a listing page: the listing's own photos (path includes
// `Hosting-{roomId}`), other listings shown in "Explore Dubai" footer, and
// sitewide decorative images. We keep just the first kind, then collapse
// different size variants of the same photo down to one.
function extractListingPhotos(html: string, roomId: string | null): string[] {
  const raw = new Set<string>();
  if (roomId) {
    const re = new RegExp(
      `https://[a-z0-9-]+\\.muscache\\.com/im/pictures/(?:hosting|miso|prohost-api|monet|airflow)/Hosting-${roomId}/[^\\s"'\\\\<>)]+\\.(?:jpg|jpeg|png|webp)`,
      "gi",
    );
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      raw.add(m[0].replace(/\\u002F/gi, "/"));
    }
  }
  if (raw.size === 0) {
    const re =
      /https:\/\/[a-z0-9-]+\.muscache\.com\/im\/pictures\/(?:hosting|miso|prohost-api|monet|airflow)\/Hosting-\d+\/[^\s"'\\<>)]+\.(?:jpg|jpeg|png|webp)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      raw.add(m[0]);
    }
  }
  // Dedupe size variants. Airbnb URLs look like
  //   .../Hosting-{roomId}/{size}/{uuid}.{ext}
  // where {size} is one of original / 1x / 1200x768 / etc. We keep one URL
  // per unique {uuid}.{ext}, preferring an "/original/" or "/large/" variant
  // when present.
  const byKey = new Map<string, string>();
  const rank = (url: string) =>
    /\/original\//i.test(url)
      ? 4
      : /\/large/i.test(url)
        ? 3
        : /\/medium/i.test(url)
          ? 2
          : 1;
  for (const url of raw) {
    const filename = url.split("/").pop() ?? url;
    const key = filename.toLowerCase();
    const prev = byKey.get(key);
    if (!prev || rank(url) > rank(prev)) {
      byKey.set(key, url);
    }
  }
  return Array.from(byKey.values());
}

// Generic recursive walker — visits every object in a JSON tree.
function walk(node: unknown, visit: (node: unknown) => void): void {
  visit(node);
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
  } else {
    for (const key of Object.keys(node)) {
      walk((node as Record<string, unknown>)[key], visit);
    }
  }
}

// Parse every JSON-bearing <script> tag and return the parsed roots.
function parseAllJsonScripts(html: string): unknown[] {
  const roots: unknown[] = [];
  // Airbnb tags include: <script id="data-deferred-state-0" type="application/json">
  // and <script type="application/json">…</script>. We accept both.
  const re =
    /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    if (!raw || raw.length < 50) continue;
    try {
      roots.push(JSON.parse(raw));
    } catch {
      // ignore non-JSON / HTML-escaped blocks
    }
  }
  return roots;
}

// Extract amenities from Airbnb's Apollo state. The shape we look for is the
// classic `OBJECT_HEADER → AMENITY_GROUP → items[].title` arrangement, as
// well as flat lists where each item has a `title` and an `available: true`
// flag. We collect titles from any object that matches the latter shape.
function extractAmenities(roots: unknown[]): string[] {
  const out = new Set<string>();
  for (const root of roots) {
    walk(root, (node) => {
      if (!node || typeof node !== "object" || Array.isArray(node)) return;
      const o = node as Record<string, unknown>;
      // Shape A: { title: "Wifi", available: true, ... } — used inside the
      // "What this place offers" amenities sections.
      if (
        typeof o.title === "string" &&
        o.title.length < 80 &&
        (o.available === true || o.available === undefined) &&
        ("icon" in o ||
          "iconImage" in o ||
          "additionalDescription" in o ||
          "tooltipDescription" in o)
      ) {
        out.add(o.title);
      }
      // Shape B: Schema.org amenityFeature → { name: "Wifi" } from JSON-LD.
      if (
        typeof o.name === "string" &&
        o["@type"] === "LocationFeatureSpecification"
      ) {
        out.add(o.name);
      }
    });
  }
  return Array.from(out);
}

function extractRoomCountsFromHtml(html: string) {
  const result: {
    maxGuests?: number;
    bedrooms?: number;
    beds?: number;
    bathrooms?: number;
  } = {};
  const guests = html.match(/(\d+)\s*guests?/i);
  if (guests) result.maxGuests = parseInt(guests[1], 10);
  const beds = html.match(/(\d+)\s*beds?\b/i);
  if (beds) result.beds = parseInt(beds[1], 10);
  const bedrooms = html.match(/(\d+)\s*bedrooms?/i);
  if (bedrooms) result.bedrooms = parseInt(bedrooms[1], 10);
  const baths = html.match(/([\d.]+)\s*(?:bath|bathroom)s?/i);
  if (baths) result.bathrooms = parseFloat(baths[1]);
  return result;
}

export async function crawlAirbnbAction(propertyId: string): Promise<CrawlState> {
  await requireRole("ADMIN");

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, airbnbUrl: true },
  });
  if (!property) {
    return { status: "error", message: "Property not found" };
  }
  if (!property.airbnbUrl) {
    return { status: "error", message: "Add the Airbnb listing URL first" };
  }

  let html: string;
  try {
    const res = await fetch(property.airbnbUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      return { status: "error", message: `Airbnb returned HTTP ${res.status}` };
    }
    html = await res.text();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    return { status: "error", message: `Could not reach Airbnb: ${msg}` };
  }

  if (html.length < 5_000 || /captcha|verify you are/i.test(html.slice(0, 5000))) {
    return {
      status: "error",
      message: "Airbnb served a captcha — open the link in a browser first, then retry.",
    };
  }

  const roomId = getRoomId(property.airbnbUrl);
  const jsonLd = parseJsonLd(html);
  const jsonRoots = parseAllJsonScripts(html);

  const description = jsonLd ? asString(jsonLd.description) : null;

  // Photos — listing-scoped only.
  const photoUrls = extractListingPhotos(html, roomId);
  const photos = photoUrls.map((url) => ({ url }));

  // Amenities — prefer the deeply walked Apollo state, fall back to JSON-LD.
  const amenitiesFromApollo = extractAmenities(jsonRoots);
  const amenitiesFromLd = (() => {
    if (!jsonLd || !Array.isArray(jsonLd.amenityFeature)) return [];
    return (jsonLd.amenityFeature as unknown[])
      .map((a) => {
        if (typeof a === "string") return a;
        if (a && typeof a === "object" && "name" in a)
          return asString((a as { name: unknown }).name);
        return null;
      })
      .filter((s): s is string => !!s);
  })();
  const amenities = Array.from(
    new Set([...amenitiesFromApollo, ...amenitiesFromLd]),
  );

  const maxGuestsLd = jsonLd ? asNumber(jsonLd.occupancy?.maxValue) : null;
  const bedroomsLd = jsonLd ? asNumber(jsonLd.numberOfRooms) : null;
  const counts = extractRoomCountsFromHtml(html);

  // Bail out BEFORE we touch the DB if extraction came up empty. A failed
  // crawl shouldn't wipe out a previous good snapshot.
  if (photos.length === 0 && amenities.length === 0 && !description) {
    return {
      status: "error",
      message:
        "Reached Airbnb but couldn't extract listing data. The page layout may have changed.",
    };
  }

  // Single update = clean replacement. Any previously-crawled value gets
  // overwritten with the fresh snapshot (or null if not found this run), so
  // there's no stale data lingering after a re-crawl.
  await prisma.property.update({
    where: { id: property.id },
    data: {
      description: description ?? null,
      photos: photos.length
        ? (photos as unknown as Prisma.InputJsonValue)
        : Prisma.DbNull,
      amenities: amenities.length
        ? (amenities as unknown as Prisma.InputJsonValue)
        : Prisma.DbNull,
      maxGuests: maxGuestsLd ?? counts.maxGuests ?? null,
      bedrooms: bedroomsLd ?? counts.bedrooms ?? null,
      beds: counts.beds ?? null,
      bathrooms: counts.bathrooms ?? null,
      crawledAt: new Date(),
      crawlPayload: jsonLd
        ? (jsonLd as unknown as Prisma.InputJsonValue)
        : Prisma.DbNull,
    },
  });
  revalidatePath("/", "layout");

  const finalGuests = maxGuestsLd ?? counts.maxGuests ?? null;
  const summary = [
    `${photos.length} photos`,
    amenities.length > 0 ? `${amenities.length} amenities` : null,
    description ? "description" : null,
    finalGuests != null ? `${finalGuests} guests` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return { status: "ok", message: `Refreshed: ${summary}` };
}
