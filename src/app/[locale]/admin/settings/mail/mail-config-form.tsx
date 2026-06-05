"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  AlertCircle,
  Send,
  Lock,
} from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import {
  upsertMailConfigAction,
  sendTestMailAction,
} from "@/app/actions/mail-config";

type Initial = {
  host: string;
  port: number;
  secure: boolean;
  username: string | null;
  fromEmail: string;
  fromName: string | null;
  replyTo: string | null;
  enabled: boolean;
  hasPassword: boolean;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastTestErr: string | null;
};

export function MailConfigForm({
  initial,
  currentUserEmail,
}: {
  initial: Initial | null;
  currentUserEmail: string;
}) {
  const router = useRouter();
  const [pending, startTx] = useTransition();
  const [host, setHost] = useState(initial?.host ?? "smtp.gmail.com");
  const [port, setPort] = useState(initial?.port ?? 587);
  const [secure, setSecure] = useState(initial?.secure ?? false);
  const [username, setUsername] = useState(initial?.username ?? "");
  const [password, setPassword] = useState("");
  const [fromEmail, setFromEmail] = useState(initial?.fromEmail ?? "");
  const [fromName, setFromName] = useState(initial?.fromName ?? "Badam");
  const [replyTo, setReplyTo] = useState(initial?.replyTo ?? "");
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Test-send local state.
  const [testTo, setTestTo] = useState(currentUserEmail);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const handleSave = () => {
    setError(null);
    setSaved(false);
    startTx(async () => {
      try {
        await upsertMailConfigAction({
          host,
          port,
          secure,
          username,
          password,
          fromEmail,
          fromName,
          replyTo,
          enabled,
        });
        setPassword(""); // clear the field after saving
        setSaved(true);
        setTimeout(() => setSaved(false), 1800);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
      }
    });
  };

  const handleTest = () => {
    setTestResult(null);
    startTx(async () => {
      const r = await sendTestMailAction(testTo);
      setTestResult(r);
    });
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardBody className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Server
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto]">
            <Field label="SMTP host" htmlFor="mc-host">
              <Input
                id="mc-host"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="smtp.gmail.com"
                required
              />
            </Field>
            <Field label="Port" htmlFor="mc-port">
              <Input
                id="mc-port"
                type="number"
                value={port}
                onChange={(e) => setPort(parseInt(e.target.value, 10) || 587)}
                className="w-24"
              />
            </Field>
            <Field label="SSL/TLS" hint="465 → on">
              <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border-2 border-[var(--color-border)] bg-white px-3 text-sm">
                <input
                  type="checkbox"
                  checked={secure}
                  onChange={(e) => setSecure(e.target.checked)}
                  className="h-4 w-4 accent-emerald-600"
                />
                Secure
              </label>
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Username" htmlFor="mc-user">
              <Input
                id="mc-user"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="badam@yourdomain.com"
              />
            </Field>
            <Field
              label="Password"
              htmlFor="mc-pass"
              hint={
                initial?.hasPassword
                  ? "Leave blank to keep the existing password."
                  : undefined
              }
            >
              <Input
                id="mc-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={initial?.hasPassword ? "••••••••" : "App password"}
                autoComplete="new-password"
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Sender identity
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="From email" htmlFor="mc-from-email">
              <Input
                id="mc-from-email"
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="noreply@badam.ae"
                required
              />
            </Field>
            <Field label="From name" htmlFor="mc-from-name">
              <Input
                id="mc-from-name"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Badam"
              />
            </Field>
          </div>
          <Field label="Reply-to" htmlFor="mc-reply-to" hint="Optional">
            <Input
              id="mc-reply-to"
              type="email"
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
              placeholder="hello@badam.ae"
            />
          </Field>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[var(--color-border)] bg-white px-3 py-2.5">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-emerald-600"
            />
            <span className="flex-1">
              <span className="block text-sm font-medium">
                Sending enabled
              </span>
              <span className="block text-xs text-[var(--color-muted)]">
                When off, the app stops sending mail but the config is
                preserved.
              </span>
            </span>
          </label>
        </CardBody>
      </Card>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Saved
          </span>
        )}
        <Button onClick={handleSave} loading={pending}>
          <Lock className="h-4 w-4" />
          Save config
        </Button>
      </div>

      {/* Test send card */}
      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Send a test
            </h2>
            {initial?.lastTestAt && (
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                  initial.lastTestOk
                    ? "text-emerald-700"
                    : "text-rose-600"
                }`}
              >
                {initial.lastTestOk ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5" />
                )}
                Last test {new Date(initial.lastTestAt).toLocaleString()}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--color-muted)]">
            Sends a one-shot message using the saved config. Save your
            changes first — the test uses the persisted values, not the
            unsaved form.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Recipient" htmlFor="mc-test-to">
              <Input
                id="mc-test-to"
                type="email"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>
            <Button
              variant="secondary"
              onClick={handleTest}
              loading={pending}
              disabled={!testTo}
            >
              <Send className="h-4 w-4" />
              Send test
            </Button>
          </div>
          {testResult && (
            <div
              className={`rounded-xl border px-3 py-2 text-sm ${
                testResult.ok
                  ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-600"
              }`}
            >
              {testResult.message}
            </div>
          )}
          {initial?.lastTestErr && !testResult && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs text-rose-700">
              Previous error: {initial.lastTestErr}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
