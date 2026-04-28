import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { locales } from "@/i18n/config";
import { getSettings } from "@/lib/settings";
import "../globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    title: { default: s.brandName, template: `%s · ${s.brandName}` },
    description: s.tagline || s.about || "Property management for owners.",
    applicationName: s.brandName,
    appleWebApp: { capable: true, statusBarStyle: "default", title: s.brandName },
    formatDetection: { telephone: false },
    icons: s.faviconUrl ? { icon: s.faviconUrl } : undefined,
  };
}

export const viewport = {
  themeColor: "#4f8a6f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  colorScheme: "light",
} as const;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(locales, locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  return (
    <html lang={locale} className={`${jakarta.variable} h-full antialiased`} style={{ colorScheme: "light only" }}>
      <head>
        <meta name="color-scheme" content="light only" />
      </head>
      <body className="min-h-dvh flex flex-col bg-white text-[#0f1f1a]">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
