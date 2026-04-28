// Plain (non-"use server") module so client components can read the
// constants directly. Server actions in @/app/actions/expenses re-export
// from here.

export const EXPENSE_TYPES = [
  "DEWA",
  "CHILLER",
  "DU",
  "GAS",
  "CLEANING",
  "DTCM",
  "SERVICE_CHARGE",
  "OTHERS",
] as const;

export type ExpenseTypeKey = (typeof EXPENSE_TYPES)[number];

export const EXPENSE_TYPE_LABELS: Record<ExpenseTypeKey, string> = {
  DEWA: "DEWA",
  CHILLER: "Chiller / Tasleem",
  DU: "Du / Internet",
  GAS: "Gas",
  CLEANING: "Cleaning",
  DTCM: "DTCM Registration",
  SERVICE_CHARGE: "Service charge",
  OTHERS: "Others",
};

export const EXPENSE_TYPE_TONE: Record<ExpenseTypeKey, string> = {
  DEWA: "bg-amber-100 text-amber-700",
  CHILLER: "bg-sky-100 text-sky-700",
  DU: "bg-violet-100 text-violet-700",
  GAS: "bg-orange-100 text-orange-700",
  CLEANING: "bg-emerald-100 text-emerald-700",
  DTCM: "bg-rose-100 text-rose-700",
  SERVICE_CHARGE: "bg-indigo-100 text-indigo-700",
  OTHERS: "bg-slate-100 text-slate-600",
};
