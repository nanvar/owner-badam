"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { login, logout, readSession } from "@/lib/auth";
import { defaultLocale, isLocale } from "@/i18n/config";

const LoginSchema = z.object({
  email: z.string().email().min(3),
  password: z.string().min(4),
});

export type LoginState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "ok" };

export async function loginAction(
  _prev: LoginState | undefined,
  formData: FormData,
): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Please check your credentials." };
  }
  const result = await login(parsed.data.email, parsed.data.password);
  if (!result.ok) {
    return { status: "error", message: result.error };
  }
  const localeRaw = (formData.get("locale") as string) || defaultLocale;
  const locale = isLocale(localeRaw) ? localeRaw : defaultLocale;
  redirect(`/${locale}/${result.role.toLowerCase()}`);
}

export async function logoutAction() {
  const session = await readSession();
  const locale = session?.locale && isLocale(session.locale) ? session.locale : defaultLocale;
  await logout();
  redirect(`/${locale}/login`);
}
