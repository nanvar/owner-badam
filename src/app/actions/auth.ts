"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  hashPassword,
  login,
  logout,
  readSession,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(6).max(200),
    confirmPassword: z.string().min(1),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "New passwords do not match.",
    path: ["confirmPassword"],
  });

export type ChangePasswordState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "error"; message: string };

export async function changeOwnPasswordAction(
  _prev: ChangePasswordState | undefined,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = await readSession();
  if (!session) {
    return { status: "error", message: "You are not signed in." };
  }
  const parsed = ChangePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message:
        parsed.error.issues[0]?.message ??
        "Password must be at least 6 characters.",
    };
  }
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, password: true },
  });
  if (!user) return { status: "error", message: "User not found." };
  const valid = await verifyPassword(parsed.data.currentPassword, user.password);
  if (!valid) {
    return { status: "error", message: "Current password is incorrect." };
  }
  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return {
      status: "error",
      message: "New password must be different from the current one.",
    };
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { password: await hashPassword(parsed.data.newPassword) },
  });
  revalidatePath("/", "layout");
  return { status: "ok" };
}
