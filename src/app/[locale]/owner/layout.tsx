import { setRequestLocale, getTranslations } from "next-intl/server";
import {
  LayoutDashboard,
  Calendar,
  FileText,
  Wallet,
  Bell,
  BedDouble,
  Home as HomeIcon,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PwaBoot } from "@/components/pwa-boot";
import { ActivityBell } from "@/components/activity-bell";
import { PageTransition } from "@/components/owner/page-transition";
import { requireRole } from "@/lib/auth";
import { isLocale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { getSettings } from "@/lib/settings";

export default async function OwnerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const session = await requireRole("OWNER");
  const t = await getTranslations({ locale, namespace: "common" });
  const settings = await getSettings();
  const nav = [
    {
      href: `/${locale}/owner`,
      label: t("dashboard"),
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      href: `/${locale}/owner/properties`,
      label: "Properties",
      icon: <HomeIcon className="h-4 w-4" />,
    },
    {
      href: `/${locale}/owner/calendar`,
      label: t("calendar"),
      icon: <Calendar className="h-4 w-4" />,
    },
    {
      href: `/${locale}/owner/payments`,
      label: t("payments"),
      icon: <Wallet className="h-4 w-4" />,
    },
    {
      href: `/${locale}/owner/reports`,
      label: t("reports"),
      icon: <FileText className="h-4 w-4" />,
    },
    {
      href: `/${locale}/owner/stay-requests`,
      label: "Stay requests",
      icon: <BedDouble className="h-4 w-4" />,
    },
    {
      href: `/${locale}/owner/activity`,
      label: "Activity",
      icon: <Bell className="h-4 w-4" />,
    },
  ];

  return (
    <AppShell
      locale={locale}
      user={{ name: session.name, email: session.email, role: session.role }}
      nav={nav}
      variant="owner"
      topRight={<ActivityBell locale={locale} />}
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
      <PwaBoot />
      <PageTransition>{children}</PageTransition>
    </AppShell>
  );
}
