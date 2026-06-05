// SMTP sender backed by the MailConfig DB row. Building the
// transport per send is cheap (nodemailer pools), and reading the
// config each time keeps admin config changes effective immediately
// without restarts.

import nodemailer from "nodemailer";
import { prisma } from "./prisma";

const SINGLETON_KEY = "default";

export async function readMailConfig() {
  return prisma.mailConfig.findUnique({ where: { key: SINGLETON_KEY } });
}

export async function mailConfigured(): Promise<boolean> {
  const cfg = await readMailConfig();
  return !!cfg && cfg.enabled && !!cfg.host && !!cfg.fromEmail;
}

export type SendMailInput = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
};

export async function sendMail(
  input: SendMailInput,
): Promise<{ messageId: string }> {
  const cfg = await readMailConfig();
  if (!cfg) throw new Error("Mail is not configured.");
  if (!cfg.enabled) throw new Error("Mail sending is disabled in settings.");
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth:
      cfg.username && cfg.password
        ? { user: cfg.username, pass: cfg.password }
        : undefined,
  });
  const from = cfg.fromName
    ? `"${cfg.fromName}" <${cfg.fromEmail}>`
    : cfg.fromEmail;
  const result = await transport.sendMail({
    from,
    to: Array.isArray(input.to) ? input.to.join(", ") : input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    replyTo: input.replyTo ?? cfg.replyTo ?? undefined,
  });
  return { messageId: result.messageId };
}
