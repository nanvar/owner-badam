import { redirect, notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { readSession } from "@/lib/auth";

export default async function LocaleRootPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await readSession();
  if (session) {
    redirect(`/${locale}/${session.role.toLowerCase()}`);
  }
  redirect(`/${locale}/login`);
}
