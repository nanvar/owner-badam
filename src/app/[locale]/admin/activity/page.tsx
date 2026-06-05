import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ActivityView } from "@/app/[locale]/owner/activity/activity-view";

const PAGE_SIZE = 25;

export default async function AdminActivityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const session = await requireRole("ADMIN");

  const rows = await prisma.activityEvent.findMany({
    where: { ownerId: session.userId },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
  });
  const hasMore = rows.length > PAGE_SIZE;
  const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;
  const unreadCount = await prisma.activityEvent.count({
    where: { ownerId: session.userId, readAt: null },
  });

  return (
    <ActivityView
      locale={locale as Locale}
      initialItems={items.map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        body: r.body,
        data: r.data,
        readAt: r.readAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      }))}
      initialNextCursor={nextCursor}
      initialUnread={unreadCount}
    />
  );
}
