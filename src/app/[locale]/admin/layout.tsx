import { setRequestLocale, getTranslations } from "next-intl/server";
import { Building2, ListTree, Users, Settings as SettingsIcon } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";
import { isLocale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { getSettings } from "@/lib/settings";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const session = await requireRole("ADMIN");
  const t = await getTranslations({ locale, namespace: "admin" });
  const tCommon = await getTranslations({ locale, namespace: "common" });
  const settings = await getSettings();

  const nav = [
    {
      href: `/${locale}/admin`,
      label: t("navProperties"),
      icon: <Building2 className="h-4 w-4" />,
    },
    {
      href: `/${locale}/admin/reservations`,
      label: t("navReservations"),
      icon: <ListTree className="h-4 w-4" />,
    },
    {
      href: `/${locale}/admin/owners`,
      label: t("navOwners"),
      icon: <Users className="h-4 w-4" />,
    },
    {
      href: `/${locale}/admin/settings`,
      label: tCommon("settings"),
      icon: <SettingsIcon className="h-4 w-4" />,
    },
  ];

  return (
    <AppShell
      locale={locale}
      user={{ name: session.name, email: session.email, role: session.role }}
      nav={nav}
      variant="admin"
      brand={{ name: settings.brandName, logoUrl: settings.logoUrl }}
    >
      {children}
    </AppShell>
  );
}
