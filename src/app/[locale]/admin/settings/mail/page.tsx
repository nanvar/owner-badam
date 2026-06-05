import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/app-shell";
import { readMailConfig } from "@/lib/mail";
import { MailConfigForm } from "./mail-config-form";

export default async function AdminMailSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const session = await requireRole("SUPERADMIN");
  const cfg = await readMailConfig();

  return (
    <div>
      <PageHeader
        title="Mail (SMTP)"
        subtitle={
          <span className="text-sm text-[var(--color-muted)]">
            Used when sending reports, invitations and notifications to
            owners.
          </span>
        }
      />
      <MailConfigForm
        initial={
          cfg
            ? {
                host: cfg.host,
                port: cfg.port,
                secure: cfg.secure,
                username: cfg.username,
                fromEmail: cfg.fromEmail,
                fromName: cfg.fromName,
                replyTo: cfg.replyTo,
                enabled: cfg.enabled,
                hasPassword: !!cfg.password,
                lastTestAt: cfg.lastTestAt?.toISOString() ?? null,
                lastTestOk: cfg.lastTestOk,
                lastTestErr: cfg.lastTestErr,
              }
            : null
        }
        currentUserEmail={session.email}
      />
    </div>
  );
}
