"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

const SettingsSchema = z.object({
  brandName: z.string().min(1).max(120),
  legalName: z.string().max(120).optional().or(z.literal("")),
  tagline: z.string().max(255).optional().or(z.literal("")),
  logoUrl: z.string().url().optional().or(z.literal("")),
  faviconUrl: z.string().url().optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  whatsapp: z.string().max(50).optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  address: z.string().max(255).optional().or(z.literal("")),
  city: z.string().max(80).optional().or(z.literal("")),
  country: z.string().max(80).optional().or(z.literal("")),
  instagram: z.string().url().optional().or(z.literal("")),
  facebook: z.string().url().optional().or(z.literal("")),
  linkedin: z.string().url().optional().or(z.literal("")),
  tiktok: z.string().url().optional().or(z.literal("")),
  youtube: z.string().url().optional().or(z.literal("")),
  bookingUrl: z.string().url().optional().or(z.literal("")),
  ownerPortal: z.string().url().optional().or(z.literal("")),
  about: z.string().max(2000).optional().or(z.literal("")),
  currency: z.string().min(3).max(8).default("AED"),
  timezone: z.string().min(1).max(80).default("Asia/Dubai"),
});

export type SettingsState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "error"; message: string };

export async function updateSettingsAction(
  _prev: SettingsState | undefined,
  formData: FormData,
): Promise<SettingsState> {
  await requireRole("ADMIN");
  const data = Object.fromEntries(
    [
      "brandName",
      "legalName",
      "tagline",
      "logoUrl",
      "faviconUrl",
      "email",
      "phone",
      "whatsapp",
      "website",
      "address",
      "city",
      "country",
      "instagram",
      "facebook",
      "linkedin",
      "tiktok",
      "youtube",
      "bookingUrl",
      "ownerPortal",
      "about",
      "currency",
      "timezone",
    ].map((k) => [k, (formData.get(k) as string | null) ?? ""]),
  );
  const parsed = SettingsSchema.safeParse(data);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const v = parsed.data;
  const norm = (s: string | undefined | null) => (s && s.length ? s : null);
  await prisma.appSettings.upsert({
    where: { id: 1 },
    update: {
      brandName: v.brandName,
      legalName: v.legalName || "",
      tagline: v.tagline || "",
      logoUrl: norm(v.logoUrl),
      faviconUrl: norm(v.faviconUrl),
      email: norm(v.email),
      phone: norm(v.phone),
      whatsapp: norm(v.whatsapp),
      website: norm(v.website),
      address: norm(v.address),
      city: norm(v.city),
      country: norm(v.country),
      instagram: norm(v.instagram),
      facebook: norm(v.facebook),
      linkedin: norm(v.linkedin),
      tiktok: norm(v.tiktok),
      youtube: norm(v.youtube),
      bookingUrl: norm(v.bookingUrl),
      ownerPortal: norm(v.ownerPortal),
      about: norm(v.about),
      currency: v.currency,
      timezone: v.timezone,
    },
    create: {
      id: 1,
      brandName: v.brandName,
      legalName: v.legalName || "",
      tagline: v.tagline || "",
      logoUrl: norm(v.logoUrl),
      faviconUrl: norm(v.faviconUrl),
      email: norm(v.email),
      phone: norm(v.phone),
      whatsapp: norm(v.whatsapp),
      website: norm(v.website),
      address: norm(v.address),
      city: norm(v.city),
      country: norm(v.country),
      instagram: norm(v.instagram),
      facebook: norm(v.facebook),
      linkedin: norm(v.linkedin),
      tiktok: norm(v.tiktok),
      youtube: norm(v.youtube),
      bookingUrl: norm(v.bookingUrl),
      ownerPortal: norm(v.ownerPortal),
      about: norm(v.about),
      currency: v.currency,
      timezone: v.timezone,
    },
  });
  revalidatePath("/", "layout");
  return { status: "ok" };
}
