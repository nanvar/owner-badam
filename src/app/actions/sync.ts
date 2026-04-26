"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { syncProperties, syncProperty, type SyncOutcome } from "@/lib/ical-sync";

export type SyncState =
  | { status: "idle" }
  | { status: "ok"; results: SyncOutcome[] }
  | { status: "error"; message: string };

export async function syncAllAction(): Promise<SyncState> {
  await requireRole("ADMIN");
  try {
    const results = await syncProperties();
    revalidatePath("/", "layout");
    return { status: "ok", results };
  } catch (err) {
    return { status: "error", message: (err as Error).message };
  }
}

export async function syncOneAction(propertyId: string): Promise<SyncState> {
  await requireRole("ADMIN");
  try {
    const result = await syncProperty(propertyId);
    revalidatePath("/", "layout");
    return { status: "ok", results: [result] };
  } catch (err) {
    return { status: "error", message: (err as Error).message };
  }
}
