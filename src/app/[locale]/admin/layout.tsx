import { setRequestLocale, getTranslations } from "next-intl/server";
import {
  LayoutDashboard,
  ListTree,
  Receipt,
  Users,
  ShieldCheck,
  Settings as SettingsIcon,
} from "lucide-react";
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

  const isSuperadmin = session.role === "SUPERADMIN";

  const nav = [
    // SUPERADMIN-only top items.
    ...(isSuperadmin
      ? [
          {
            href: `/${locale}/admin/company`,
            label: "Company",
            icon: <LayoutDashboard className="h-4 w-4" />,
          },
          {
            href: `/${locale}/admin/company/expenses`,
            label: "Company expenses",
            icon: <Receipt className="h-4 w-4" />,
          },
        ]
      : []),
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
    ...(isSuperadmin
      ? [
          {
            href: `/${locale}/admin/staff`,
            label: "Staff",
            icon: <ShieldCheck className="h-4 w-4" />,
          },
        ]
      : []),
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
      brand={{
        name: settings.brandName,
        logoUrl: settings.logoUrl,
        legalName: settings.legalName,
        email: settings.email,
        phone: settings.phone,
        whatsapp: settings.whatsapp,
        website: settings.website,
        address: settings.address,
      }}
    >
      {children}
    </AppShell>
  );
}
