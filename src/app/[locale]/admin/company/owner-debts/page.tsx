import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { OwnerDebtsView } from "./owner-debts-view";

const PAGE_SIZE = 25;

export default async function OwnerDebtsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  await requireRole("ADMIN");

  const sp = await searchParams;
  const tab = sp.tab === "PAID" ? "PAID" : "PENDING";
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);

  const [pendingCount, paidCount, entries, totals] = await Promise.all([
    prisma.ownerDebt.count({ where: { status: "PENDING" } }),
    prisma.ownerDebt.count({ where: { status: "PAID" } }),
    prisma.ownerDebt.findMany({
      where: { status: tab },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        property: { select: { id: true, name: true, color: true } },
        expense: {
          select: { id: true, type: true, description: true, date: true },
        },
      },
      orderBy:
        tab === "PENDING"
          ? { createdAt: "asc" } // oldest unpaid first
          : { paidAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.ownerDebt.groupBy({
      by: ["status"],
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);
  const tabCount = tab === "PENDING" ? pendingCount : paidCount;
  const totalPages = Math.max(1, Math.ceil(tabCount / PAGE_SIZE));
  const pendingTotal =
    totals.find((r) => r.status === "PENDING")?._sum.amount ?? 0;
  const paidTotal = totals.find((r) => r.status === "PAID")?._sum.amount ?? 0;

  return (
    <OwnerDebtsView
      locale={locale as Locale}
      basePath={`/${locale}/admin/company/owner-debts`}
      tab={tab}
      page={page}
      totalPages={totalPages}
      counts={{ PENDING: pendingCount, PAID: paidCount }}
      totals={{ pending: pendingTotal, paid: paidTotal }}
      entries={entries.map((e) => ({
        id: e.id,
        ownerId: e.ownerId,
        ownerName: e.owner.name ?? e.owner.email,
        propertyId: e.propertyId,
        propertyName: e.property?.name ?? null,
        propertyColor: e.property?.color ?? null,
        expenseId: e.expenseId,
        expenseType: e.expense?.type ?? null,
        expenseDate: e.expense?.date.toISOString() ?? null,
        amount: e.amount,
        description: e.description,
        status: e.status,
        paidAt: e.paidAt?.toISOString() ?? null,
        createdAt: e.createdAt.toISOString(),
      }))}
    />
  );
}
