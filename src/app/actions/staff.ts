"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireRole } from "@/lib/auth";

const StaffRoleSchema = z.enum(["ADMIN", "SUPERADMIN"]);

const CreateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  password: z.string().min(6),
  role: StaffRoleSchema,
});

const UpdateSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1).max(120),
  password: z.string().min(6).optional().or(z.literal("")),
  role: StaffRoleSchema,
});

export type StaffActionState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "error"; message: string };

export async function createStaffAction(
  _prev: StaffActionState | undefined,
  formData: FormData,
): Promise<StaffActionState> {
  await requireRole("SUPERADMIN");
  const parsed = CreateSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const exists = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });
  if (exists) return { status: "error", message: "Email already in use" };
  await prisma.user.create({
    data: {
      email: parsed.data.email.toLowerCase(),
      name: parsed.data.name,
      password: await hashPassword(parsed.data.password),
      role: parsed.data.role,
    },
  });
  return { status: "ok" };
}

export async function updateStaffAction(
  _prev: StaffActionState | undefined,
  formData: FormData,
): Promise<StaffActionState> {
  const session = await requireRole("SUPERADMIN");
  const parsed = UpdateSchema.safeParse({
    id: formData.get("id"),
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password") || "",
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  // Prevent self-demotion (so we don't lock the only superadmin out).
  if (
    session.userId === parsed.data.id &&
    parsed.data.role !== "SUPERADMIN"
  ) {
    return {
      status: "error",
      message: "You can't demote yourself.",
    };
  }
  const target = await prisma.user.findUnique({
    where: { id: parsed.data.id },
    select: { role: true },
  });
  if (!target) return { status: "error", message: "User not found" };
  if (target.role === "OWNER") {
    return {
      status: "error",
      message: "Use the Owners page to edit owner accounts.",
    };
  }
  const existingByEmail = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });
  if (existingByEmail && existingByEmail.id !== parsed.data.id) {
    return { status: "error", message: "Email already in use" };
  }
  const data: {
    email: string;
    name: string;
    role: "ADMIN" | "SUPERADMIN";
    password?: string;
  } = {
    email: parsed.data.email.toLowerCase(),
    name: parsed.data.name,
    role: parsed.data.role,
  };
  if (parsed.data.password) {
    data.password = await hashPassword(parsed.data.password);
  }
  await prisma.user.update({ where: { id: parsed.data.id }, data });
  return { status: "ok" };
}

export async function deleteStaffAction(id: string) {
  const session = await requireRole("SUPERADMIN");
  if (session.userId === id) {
    throw new Error("Cannot delete the currently signed-in user");
  }
  const target = await prisma.user.findUnique({
    where: { id },
    select: { role: true },
  });
  if (!target) throw new Error("User not found");
  if (target.role === "OWNER") {
    throw new Error("Use the Owners page to delete owner accounts.");
  }
  await prisma.user.delete({ where: { id } });
}
