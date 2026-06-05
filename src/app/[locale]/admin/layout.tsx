import { setRequestLocale, getTranslations } from "next-intl/server";
import {
  LayoutDashboard,
  ListTree,
  Receipt,
  Users,
  ShieldCheck,
  Settings as SettingsIcon,
  Building2,
  BarChart3,
  FileText,
  Presentation,
  Banknote,
  HandCoins,
  BedDouble,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PwaBoot } from "@/components/pwa-boot";
import { ActivityBell } from "@/components/activity-bell";
import { fireAdminDailyJobsInBackground } from "@/lib/cron-jobs";
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
  // Self-healing daily-jobs trigger. Fires on the first admin request
  // of each UTC day; the unique constraint inside runDailyJobs() keeps
  // it from racing with cron. Non-blocking — page render does not
  // wait on jobs.
  fireAdminDailyJobsInBackground();
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
            label: "Dashboard",
            icon: <LayoutDashboard className="h-4 w-4" />,
          },
          {
            // Parent landing of the dropdown — clicking the parent on
            // desktop opens the menu, but href still points somewhere
            // sensible for non-JS navigation.
            href: `/${locale}/admin/company/expenses`,
            label: "Company",
            icon: <Building2 className="h-4 w-4" />,
            children: [
              {
                href: `/${locale}/admin/company/expenses`,
                label: "Finances",
                icon: <Receipt className="h-4 w-4" />,
              },
              {
                href: `/${locale}/admin/company/investments`,
                label: "Investments",
                icon: <Banknote className="h-4 w-4" />,
              },
              {
                href: `/${locale}/admin/company/owner-debts`,
                label: "Owner debts",
                icon: <HandCoins className="h-4 w-4" />,
              },
              {
                href: `/${locale}/admin/company/reporting`,
                label: "Reporting",
                icon: <BarChart3 className="h-4 w-4" />,
              },
              {
                href: `/${locale}/admin/staff`,
                label: "Staff",
                icon: <ShieldCheck className="h-4 w-4" />,
              },
              {
                href: `/${locale}/admin/settings`,
                label: tCommon("settings"),
                icon: <SettingsIcon className="h-4 w-4" />,
              },
            ],
          },
        ]
      : []),
    {
      href: `/${locale}/admin/properties`,
      label: tCommon("properties"),
      icon: <Building2 className="h-4 w-4" />,
    },
    {
      href: `/${locale}/admin/reservations`,
      label: t("navReservations"),
      icon: <ListTree className="h-4 w-4" />,
    },
    {
      href: `/${locale}/admin/projection`,
      label: "Projection",
      icon: <Presentation className="h-4 w-4" />,
    },
    {
      href: `/${locale}/admin/stay-requests`,
      label: "Stay requests",
      icon: <BedDouble className="h-4 w-4" />,
    },
    {
      // Parent dropdown — landing page is the owner list, but the
      // dropdown surfaces Reports as a sibling so admins jump straight
      // to bundling settlements.
      href: `/${locale}/admin/owners`,
      label: t("navOwners"),
      icon: <Users className="h-4 w-4" />,
      children: [
        {
          href: `/${locale}/admin/owners`,
          label: t("navOwners"),
          icon: <Users className="h-4 w-4" />,
        },
        {
          href: `/${locale}/admin/reports`,
          label: "Reports",
          icon: <FileText className="h-4 w-4" />,
        },
      ],
    },
    // Non-SUPERADMIN admins still need direct access to Settings since
    // the Company dropdown is gated to SUPERADMIN only.
    ...(!isSuperadmin
      ? [
          {
            href: `/${locale}/admin/settings`,
            label: tCommon("settings"),
            icon: <SettingsIcon className="h-4 w-4" />,
          },
        ]
      : []),
  ];

  return (
    <AppShell
      locale={locale}
      user={{ name: session.name, email: session.email, role: session.role }}
      nav={nav}
      variant="admin"
      mobileNav="drawer"
      topRight={
        <ActivityBell
          locale={locale}
          viewAllHref={`/${locale}/admin/activity`}
        />
      }
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
      {children}
    </AppShell>
  );
}
