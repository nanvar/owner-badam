"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
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
        <Card
          className="border-[var(--color-border)] p-6 shadow-2xl shadow-emerald-900/20 ring-1 ring-black/5"
        >
          <div className="flex flex-col items-center text-center">
            {brand.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brand.logoUrl}
                alt={brand.name}
                className="h-14 w-auto object-contain"
              />
            ) : (
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--color-brand)] text-white shadow-lg shadow-emerald-700/25">
                <Sparkles className="h-7 w-7" />
              </span>
            )}
            <p className="mt-3 text-sm text-[var(--color-muted)]">
              {t("login.subtitle")}
            </p>
          </div>
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
                className="border-2 focus:ring-[3px]"
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
                className="border-2 focus:ring-[3px]"
              />
            </Field>
            {state?.status === "error" && (
              <div className="rounded-xl border-2 border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">
                {t("login.invalid")}
              </div>
            )}
            <Button type="submit" loading={pending} size="lg" className="w-full">
              {pending ? t("login.submitting") : t("login.submit")}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
