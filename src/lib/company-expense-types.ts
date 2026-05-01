// Plain (non-"use server") module so client components can read the
// constants directly. Server actions in @/app/actions/company-expenses
// re-import from here.

export const COMPANY_EXPENSE_CATEGORIES = [
  "SALARY",
  "RENT",
  "MARKETING",
  "SOFTWARE",
  "TRAVEL",
  "TAX",
  "UTILITIES",
  "OTHER",
] as const;

export type CompanyExpenseCategoryKey =
  (typeof COMPANY_EXPENSE_CATEGORIES)[number];

export const COMPANY_EXPENSE_CATEGORY_LABELS: Record<
  CompanyExpenseCategoryKey,
  string
> = {
  SALARY: "Salary",
  RENT: "Office rent",
  MARKETING: "Marketing",
  SOFTWARE: "Software",
  TRAVEL: "Travel",
  TAX: "Tax",
  UTILITIES: "Utilities",
  OTHER: "Other",
};

export const COMPANY_EXPENSE_CATEGORY_TONE: Record<
  CompanyExpenseCategoryKey,
  string
> = {
  SALARY: "bg-emerald-100 text-emerald-700",
  RENT: "bg-amber-100 text-amber-700",
  MARKETING: "bg-violet-100 text-violet-700",
  SOFTWARE: "bg-sky-100 text-sky-700",
  TRAVEL: "bg-orange-100 text-orange-700",
  TAX: "bg-rose-100 text-rose-700",
  UTILITIES: "bg-indigo-100 text-indigo-700",
  OTHER: "bg-slate-100 text-slate-600",
};
