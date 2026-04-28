"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles, Mail, MessageCircle, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { loginAction, type LoginState } from "@/app/actions/auth";
import type { Locale } from "@/i18n/config";

type Brand = {
  name: string;
  tagline: string;
  logoUrl: string | null;
  email: string | null;
  whatsapp: string | null;
  website: string | null;
};

export function LoginForm({ locale, brand }: { locale: Locale; brand: Brand }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState<LoginState | undefined, FormData>(
    loginAction,
    undefined,
  );

  return (
    <div
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-5 py-10"
      style={{
        background:
          "linear-gradient(160deg, #4f8a6f 0%, #3d6f57 45%, #f3f7f4 75%, #ffffff 100%)",
      }}
    >
      <div
        className="pointer-events-none absolute -right-20 top-10 h-72 w-72 rounded-full opacity-40 blur-3xl"
        style={{ background: "rgba(168,200,182,0.6)" }}
      />
      <div
        className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full opacity-50 blur-3xl"
        style={{ background: "rgba(255,255,255,0.5)" }}
      />
      <div className="relative w-full max-w-sm animate-fade-in">
        <div className="mb-6 flex flex-col items-center text-center">
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.logoUrl}
              alt={brand.name}
              className="h-12 w-auto object-contain"
            />
          ) : (
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--color-brand)] text-white shadow-lg shadow-emerald-700/25">
              <Sparkles className="h-6 w-6" />
            </span>
          )}
          <div className="mt-3 text-lg font-bold tracking-tight">{brand.name}</div>
          {brand.tagline && (
            <div className="mt-0.5 text-xs text-[var(--color-muted)]">
              {brand.tagline}
            </div>
          )}
        </div>
        <Card className="p-6">
          <h1 className="text-xl font-bold tracking-tight">{t("login.title")}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {t("login.subtitle")}
          </p>
          <form action={action} className="mt-6 space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <Field label={t("login.email")} htmlFor="email">
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
            </Field>
            <Field label={t("login.password")} htmlFor="password">
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
              />
            </Field>
            {state?.status === "error" && (
              <div className="rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">
                {t("login.invalid")}
              </div>
            )}
            <Button type="submit" loading={pending} size="lg" className="w-full">
              {pending ? t("login.submitting") : t("login.submit")}
            </Button>
          </form>
        </Card>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-[var(--color-muted)]">
          {brand.email && (
            <a href={`mailto:${brand.email}`} className="flex items-center gap-1 hover:text-[var(--color-brand)]">
              <Mail className="h-3.5 w-3.5" />
              {brand.email}
            </a>
          )}
          {brand.whatsapp && (
            <a
              href={`https://wa.me/${brand.whatsapp.replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:text-emerald-500"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {brand.whatsapp}
            </a>
          )}
          {brand.website && (
            <a
              href={brand.website}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:text-[var(--color-brand)]"
            >
              <Globe className="h-3.5 w-3.5" />
              {brand.website.replace(/^https?:\/\//, "")}
            </a>
          )}
        </div>
        <p className="mt-3 text-center text-[11px] text-[var(--color-muted)]">
          {t("login.demoHint")}
        </p>
      </div>
    </div>
  );
}
