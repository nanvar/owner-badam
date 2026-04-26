import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "./settings-form";

export default async function AdminSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const settings = await getSettings();

  const tCommon = await getTranslations({ locale, namespace: "common" });
  const t = await getTranslations({ locale, namespace: "settings" });

  return (
    <SettingsForm
      settings={{
        brandName: settings.brandName,
        legalName: settings.legalName,
        tagline: settings.tagline,
        logoUrl: settings.logoUrl ?? "",
        faviconUrl: settings.faviconUrl ?? "",
        email: settings.email ?? "",
        phone: settings.phone ?? "",
        whatsapp: settings.whatsapp ?? "",
        website: settings.website ?? "",
        address: settings.address ?? "",
        city: settings.city ?? "",
        country: settings.country ?? "",
        instagram: settings.instagram ?? "",
        facebook: settings.facebook ?? "",
        linkedin: settings.linkedin ?? "",
        tiktok: settings.tiktok ?? "",
        youtube: settings.youtube ?? "",
        bookingUrl: settings.bookingUrl ?? "",
        ownerPortal: settings.ownerPortal ?? "",
        about: settings.about ?? "",
        currency: settings.currency,
        timezone: settings.timezone,
      }}
      labels={{
        title: tCommon("settings"),
        save: tCommon("save"),
        saved: t("saved"),
        sectionBrand: t("sectionBrand"),
        sectionContact: t("sectionContact"),
        sectionSocial: t("sectionSocial"),
        sectionLinks: t("sectionLinks"),
        sectionRegional: t("sectionRegional"),
        brandName: t("brandName"),
        legalName: t("legalName"),
        tagline: t("tagline"),
        logoUrl: t("logoUrl"),
        faviconUrl: t("faviconUrl"),
        email: t("email"),
        phone: t("phone"),
        whatsapp: t("whatsapp"),
        website: t("website"),
        address: t("address"),
        city: t("city"),
        country: t("country"),
        instagram: t("instagram"),
        facebook: t("facebook"),
        linkedin: t("linkedin"),
        tiktok: t("tiktok"),
        youtube: t("youtube"),
        bookingUrl: t("bookingUrl"),
        ownerPortal: t("ownerPortal"),
        about: t("about"),
        currency: t("currency"),
        timezone: t("timezone"),
        preview: t("preview"),
      }}
    />
  );
}
