"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { sendMail } from "@/lib/mail";

const SINGLETON_KEY = "default";

const Schema = z.object({
  host: z.string().min(1).max(255),
  port: z.coerce.number().int().min(1).max(65535),
  secure: z.boolean().optional().default(false),
  username: z.string().max(255).optional().or(z.literal("")),
  // Password is optional on update — empty means "keep the existing value".
  password: z.string().max(255).optional().or(z.literal("")),
  fromEmail: z.string().email().max(255),
  fromName: z.string().max(120).optional().or(z.literal("")),
  replyTo: z.string().email().max(255).optional().or(z.literal("")),
  enabled: z.boolean().optional().default(true),
});

export async function upsertMailConfigAction(input: {
  host: string;
  port: number;
  secure: boolean;
  username?: string;
  password?: string;
  fromEmail: string;
  fromName?: string;
  replyTo?: string;
  enabled: boolean;
}) {
  await requireRole("SUPERADMIN");
  const parsed = Schema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "invalid mail config");
  }
  const v = parsed.data;
  const existing = await prisma.mailConfig.findUnique({
    where: { key: SINGLETON_KEY },
  });
  // Empty password on update = keep the old one. On create an empty
  // password is fine too (some relays don't need auth).
  const password = v.password
    ? v.password
    : existing?.password ?? null;
  await prisma.mailConfig.upsert({
    where: { key: SINGLETON_KEY },
    create: {
      key: SINGLETON_KEY,
      host: v.host,
      port: v.port,
      secure: v.secure,
      username: v.username || null,
      password,
      fromEmail: v.fromEmail,
      fromName: v.fromName || null,
      replyTo: v.replyTo || null,
      enabled: v.enabled,
    },
    update: {
      host: v.host,
      port: v.port,
      secure: v.secure,
      username: v.username || null,
      password,
      fromEmail: v.fromEmail,
      fromName: v.fromName || null,
      replyTo: v.replyTo || null,
      enabled: v.enabled,
    },
  });
}

const TestSchema = z.object({
  to: z.string().email().max(255),
});

export async function sendTestMailAction(to: string): Promise<{
  ok: boolean;
  message: string;
}> {
  await requireRole("SUPERADMIN");
  const parsed = TestSchema.safeParse({ to });
  if (!parsed.success) {
    return { ok: false, message: "Invalid recipient email." };
  }
  try {
    const r = await sendMail({
      to: parsed.data.to,
      subject: "Badam · SMTP test",
      text: "If you got this, SMTP is wired correctly.",
      html: `
        <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;padding:24px;background:#fbf8f1;">
          <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:24px;border:1px solid #e9edef;">
            <h2 style="margin:0 0 8px;color:#1f2734;">SMTP test ✓</h2>
            <p style="margin:0;color:#5c6675;">If you got this, the Badam SMTP relay is configured correctly.</p>
          </div>
        </div>
      `,
    });
    await prisma.mailConfig.update({
      where: { key: SINGLETON_KEY },
      data: { lastTestAt: new Date(), lastTestOk: true, lastTestErr: null },
    });
    return { ok: true, message: `Sent (id: ${r.messageId})` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.mailConfig
      .update({
        where: { key: SINGLETON_KEY },
        data: { lastTestAt: new Date(), lastTestOk: false, lastTestErr: message },
      })
      .catch(() => undefined);
    return { ok: false, message };
  }
}
