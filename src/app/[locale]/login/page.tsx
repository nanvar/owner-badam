import { setRequestLocale } from "next-intl/server";
import { LoginForm } from "./login-form";
import { isLocale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { getSettings } from "@/lib/settings";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const settings = await getSettings();
  return (
    <LoginForm
      locale={locale}
      brand={{
        name: settings.brandName,
        tagline: settings.tagline,
        logoUrl: settings.logoUrl,
        email: settings.email,
        whatsapp: settings.whatsapp,
        website: settings.website,
      }}
    />
  );
}
