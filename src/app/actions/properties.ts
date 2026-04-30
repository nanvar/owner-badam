"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireRole } from "@/lib/auth";

const PropertySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(120),
  address: z.string().max(255).optional().or(z.literal("")),
  airbnbIcalUrl: z.string().url().optional().or(z.literal("")),
  airbnbUrl: z.string().url().optional().or(z.literal("")),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#4f8a6f"),
  ownerId: z.string().min(1),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export type PropertyState =
  | { status: "idle" }
  | { status: "ok"; id: string }
  | { status: "error"; message: string };

export async function upsertPropertyAction(
  _prev: PropertyState | undefined,
  formData: FormData,
): Promise<PropertyState> {
  await requireRole("ADMIN");
  const parsed = PropertySchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    address: formData.get("address") || "",
    airbnbIcalUrl: formData.get("airbnbIcalUrl") || "",
    airbnbUrl: formData.get("airbnbUrl") || "",
    color: formData.get("color") || "#4f8a6f",
    ownerId: formData.get("ownerId"),
    notes: formData.get("notes") || "",
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;
  const upserted = data.id
    ? await prisma.property.update({
        where: { id: data.id },
        data: {
          name: data.name,
          address: data.address || null,
          airbnbIcalUrl: data.airbnbIcalUrl || null,
          airbnbUrl: data.airbnbUrl || null,
          color: data.color,
          notes: data.notes || null,
          ownerId: data.ownerId,
        },
      })
    : await prisma.property.create({
        data: {
          name: data.name,
          address: data.address || null,
          airbnbIcalUrl: data.airbnbIcalUrl || null,
          airbnbUrl: data.airbnbUrl || null,
          color: data.color,
          notes: data.notes || null,
          ownerId: data.ownerId,
        },
      });
  revalidatePath("/", "layout");
  return { status: "ok", id: upserted.id };
}

export async function deletePropertyAction(id: string) {
  await requireRole("ADMIN");
  await prisma.property.delete({ where: { id } });
  revalidatePath("/", "layout");
}

const OwnerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  password: z.string().min(4),
  phone: z.string().max(50).optional().or(z.literal("")),
  taxId: z.string().max(80).optional().or(z.literal("")),
  address: z.string().max(255).optional().or(z.literal("")),
});

export async function createOwnerAction(
  _prev: { status: string; message?: string } | undefined,
  formData: FormData,
) {
  await requireRole("ADMIN");
  const parsed = OwnerSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password"),
    phone: formData.get("phone") || "",
    taxId: formData.get("taxId") || "",
    address: formData.get("address") || "",
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const exists = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (exists) return { status: "error", message: "Email already in use" };
  await prisma.user.create({
    data: {
      email: parsed.data.email.toLowerCase(),
      name: parsed.data.name,
      password: await hashPassword(parsed.data.password),
      role: "OWNER",
      phone: parsed.data.phone || null,
      taxId: parsed.data.taxId || null,
      address: parsed.data.address || null,
    },
  });
  revalidatePath("/", "layout");
  return { status: "ok" };
}

const UpdateOwnerSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1).max(120),
  password: z.string().min(4).optional().or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  taxId: z.string().max(80).optional().or(z.literal("")),
  address: z.string().max(255).optional().or(z.literal("")),
});

export async function updateOwnerAction(
  _prev: { status: string; message?: string } | undefined,
  formData: FormData,
) {
  await requireRole("ADMIN");
  const parsed = UpdateOwnerSchema.safeParse({
    id: formData.get("id"),
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password") || "",
    phone: formData.get("phone") || "",
    taxId: formData.get("taxId") || "",
    address: formData.get("address") || "",
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" };
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
    password?: string;
    phone: string | null;
    taxId: string | null;
    address: string | null;
  } = {
    email: parsed.data.email.toLowerCase(),
    name: parsed.data.name,
    phone: parsed.data.phone || null,
    taxId: parsed.data.taxId || null,
    address: parsed.data.address || null,
  };
  if (parsed.data.password) {
    data.password = await hashPassword(parsed.data.password);
  }
  await prisma.user.update({ where: { id: parsed.data.id }, data });
  revalidatePath("/", "layout");
  return { status: "ok" };
}

export async function deleteOwnerAction(id: string) {
  const session = await requireRole("ADMIN");
  if (session.userId === id) {
    throw new Error("Cannot delete the currently signed-in user");
  }
  const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!target) throw new Error("User not found");
  if (target.role !== "OWNER") throw new Error("Can only delete OWNER users from this view");
  await prisma.user.delete({ where: { id } });
  revalidatePath("/", "layout");
}
