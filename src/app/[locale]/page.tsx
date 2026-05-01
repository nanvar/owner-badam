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
    const path =
      session.role === "SUPERADMIN"
        ? "admin/company"
        : session.role.toLowerCase();
    redirect(`/${locale}/${path}`);
  }
  redirect(`/${locale}/login`);
}
