import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/app-shell";
import { NotificationSettingsForm } from "@/components/notification-settings-form";
import { readMyNotificationPrefs } from "@/lib/notification-prefs-server";

export default async function OwnerNotificationSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  await requireRole("OWNER");
  const prefs = await readMyNotificationPrefs();

  return (
    <div>
      <PageHeader
        title="Notification settings"
        subtitle={
          <span className="text-sm text-[var(--color-muted)]">
            Pick which alerts land on your phone and in the app feed.
          </span>
        }
      />
      <NotificationSettingsForm initialPrefs={prefs} />
    </div>
  );
}
