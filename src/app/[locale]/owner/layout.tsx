import { setRequestLocale, getTranslations } from "next-intl/server";
import { LayoutDashboard, Calendar, FileText } from "lucide-react";
import { AppShell } from "@/components/app-shell";
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
      href: `/${locale}/owner/calendar`,
      label: t("calendar"),
      icon: <Calendar className="h-4 w-4" />,
    },
    {
      href: `/${locale}/owner/reports`,
      label: t("reports"),
      icon: <FileText className="h-4 w-4" />,
    },
  ];

  return (
    <AppShell
      locale={locale}
      user={{ name: session.name, email: session.email, role: session.role }}
      nav={nav}
      variant="owner"
      brand={{ name: settings.brandName, logoUrl: settings.logoUrl }}
    >
      {children}
    </AppShell>
  );
}
