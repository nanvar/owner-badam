import { prisma } from "./prisma";
import type { AppSettings } from "@/generated/prisma/client";

export type Settings = AppSettings;

export const FALLBACK_SETTINGS: Settings = {
  id: 1,
  brandName: "Badam Owners",
  legalName: "Badam Holiday Homes",
  tagline: "Curated short-term rentals across Dubai.",
  logoUrl: "https://badam.ae/assets/logo-dark.png",
  faviconUrl: null,
  email: "info@badam.ae",
  phone: "+971 55 644 7293",
  whatsapp: "+971 55 644 7293",
  website: "https://badam.ae",
  address: "Dubai",
  city: "Dubai",
  country: "United Arab Emirates",
  instagram: null,
  facebook: null,
  linkedin: null,
  tiktok: null,
  youtube: null,
  bookingUrl: "https://book.badam.ae",
  ownerPortal: "https://owners.badam.ae",
  about: null,
  currency: "AED",
  timezone: "Asia/Dubai",
  updatedAt: new Date(),
};

export async function getSettings(): Promise<Settings> {
  try {
    const row = await prisma.appSettings.findUnique({ where: { id: 1 } });
    if (row) return row;
  } catch {
    // fall through to fallback
  }
  return FALLBACK_SETTINGS;
}
