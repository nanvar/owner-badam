import { setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { isLocale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { PwaBoot } from "@/components/pwa-boot";
import { PageTransition } from "@/components/owner/page-transition";
import { OwnerShellV2 } from "@/components/owner/v2/owner-shell";

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
  const settings = await getSettings();

  return (
    <OwnerShellV2
      locale={locale}
      user={{ name: session.name, email: session.email }}
      brandLogoUrl={settings.logoUrl}
      brandName={settings.brandName}
    >
      <PwaBoot />
      <PageTransition>{children}</PageTransition>
    </OwnerShellV2>
  );
}
