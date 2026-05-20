"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

const num = z.coerce.number().nonnegative();
const ProjectionSchema = z.object({
  propertyId: z.string().min(1),
  area: z.string().max(120).optional().or(z.literal("")),
  buildingName: z.string().max(120).optional().or(z.literal("")),
  avgMonthlyNet: num.default(0),
  duMonthly: num.default(0),
  dewaChillerMonthly: num.default(0),
  propertyInsuranceYearly: num.default(0),
  maintenanceMonthly: num.default(0),
  dtcmPermitYearly: num.default(0),
  managementFeePct: num.default(20),
  vatPct: num.default(5),
  portalFeePct: num.default(10.5),
  pessimisticOccupancy: num.default(75),
  realisticOccupancy: num.default(80),
  optimisticOccupancy: num.default(85),
  pessimisticNet: num.default(0),
  realisticNet: num.default(0),
  optimisticNet: num.default(0),
  listingMgmtBullets: z.string().max(2000).optional().or(z.literal("")),
  guestMgmtBullets: z.string().max(2000).optional().or(z.literal("")),
  propertyMgmtBullets: z.string().max(2000).optional().or(z.literal("")),
  aboutText: z.string().max(4000).optional().or(z.literal("")),
});

export type PropertyProjectionState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "error"; message: string };

// Upsert the projection for a property. One projection per property
// (unique index), so this both creates the row and updates the latest
// values for the deck export.
export async function upsertPropertyProjectionAction(
  _prev: PropertyProjectionState | undefined,
  formData: FormData,
): Promise<PropertyProjectionState> {
  await requireRole("ADMIN");
  const parsed = ProjectionSchema.safeParse({
    propertyId: formData.get("propertyId"),
    area: formData.get("area") || "",
    buildingName: formData.get("buildingName") || "",
    avgMonthlyNet: formData.get("avgMonthlyNet") || 0,
    duMonthly: formData.get("duMonthly") || 0,
    dewaChillerMonthly: formData.get("dewaChillerMonthly") || 0,
    propertyInsuranceYearly: formData.get("propertyInsuranceYearly") || 0,
    maintenanceMonthly: formData.get("maintenanceMonthly") || 0,
    dtcmPermitYearly: formData.get("dtcmPermitYearly") || 0,
    managementFeePct: formData.get("managementFeePct") || 20,
    vatPct: formData.get("vatPct") || 5,
    portalFeePct: formData.get("portalFeePct") || 10.5,
    pessimisticOccupancy: formData.get("pessimisticOccupancy") || 75,
    realisticOccupancy: formData.get("realisticOccupancy") || 80,
    optimisticOccupancy: formData.get("optimisticOccupancy") || 85,
    pessimisticNet: formData.get("pessimisticNet") || 0,
    realisticNet: formData.get("realisticNet") || 0,
    optimisticNet: formData.get("optimisticNet") || 0,
    listingMgmtBullets: formData.get("listingMgmtBullets") || "",
    guestMgmtBullets: formData.get("guestMgmtBullets") || "",
    propertyMgmtBullets: formData.get("propertyMgmtBullets") || "",
    aboutText: formData.get("aboutText") || "",
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const v = parsed.data;
  const data = {
    area: v.area || "",
    buildingName: v.buildingName || "",
    avgMonthlyNet: v.avgMonthlyNet,
    duMonthly: v.duMonthly,
    dewaChillerMonthly: v.dewaChillerMonthly,
    propertyInsuranceYearly: v.propertyInsuranceYearly,
    maintenanceMonthly: v.maintenanceMonthly,
    dtcmPermitYearly: v.dtcmPermitYearly,
    managementFeePct: v.managementFeePct,
    vatPct: v.vatPct,
    portalFeePct: v.portalFeePct,
    pessimisticOccupancy: v.pessimisticOccupancy,
    realisticOccupancy: v.realisticOccupancy,
    optimisticOccupancy: v.optimisticOccupancy,
    pessimisticNet: v.pessimisticNet,
    realisticNet: v.realisticNet,
    optimisticNet: v.optimisticNet,
    listingMgmtBullets: v.listingMgmtBullets || null,
    guestMgmtBullets: v.guestMgmtBullets || null,
    propertyMgmtBullets: v.propertyMgmtBullets || null,
    aboutText: v.aboutText || null,
  };
  await prisma.propertyProjection.upsert({
    where: { propertyId: v.propertyId },
    update: data,
    create: { propertyId: v.propertyId, ...data },
  });
  return { status: "ok" };
}

export async function deletePropertyProjectionAction(propertyId: string) {
  await requireRole("ADMIN");
  await prisma.propertyProjection
    .delete({ where: { propertyId } })
    .catch(() => undefined);
}
