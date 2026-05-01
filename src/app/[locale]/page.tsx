import { redirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { readSession } from "@/lib/auth";

// Site root — there is no public landing page. Authenticated users go to
// their dashboard; everyone else lands on the login form.
export default async function LocaleRootPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await readSession();
  if (!session) redirect(`/${locale}/login`);
  if (session.role === "SUPERADMIN") redirect(`/${locale}/admin/company`);
  if (session.role === "ADMIN") redirect(`/${locale}/admin`);
  redirect(`/${locale}/owner`);
}
