import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Bell, Mail, ChevronRight } from "lucide-react";
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

  const subSettings = [
    {
      href: `/${locale}/admin/settings/notifications`,
      icon: <Bell className="h-4 w-4" />,
      title: "Notification settings",
      desc: "Pick which event categories ping this admin account.",
    },
    {
      href: `/${locale}/admin/settings/mail`,
      icon: <Mail className="h-4 w-4" />,
      title: "Mail (SMTP)",
      desc: "Configure outbound mail and send a test message.",
    },
  ];

  return (
    <>
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {subSettings.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-white p-3 hover:border-[var(--color-brand)]"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
                {s.icon}
              </div>
              <div>
                <div className="text-sm font-semibold">{s.title}</div>
                <div className="text-xs text-[var(--color-muted)]">{s.desc}</div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-[var(--color-muted)]" />
          </Link>
        ))}
      </div>
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
    </>
  );
}
