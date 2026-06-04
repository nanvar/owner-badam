// Helpers for the per-property owner stay-quota workflow.
// Used by both admin (when adjusting the quota / approving requests)
// and owner (when filing a new stay request).

import { prisma } from "./prisma";

export type QuotaStatus = {
  daysPerYear: number;
  cycleStart: Date;
  cycleEnd: Date;
  usedNights: number;
  pendingNights: number;
  remainingNights: number;
};

// Compute the [start, end) date pair of the current quota cycle. The
// cycle anchors on (yearStartMonth, yearStartDay) — defaults to Jan 1.
export function currentCycleBounds(
  yearStartMonth: number,
  yearStartDay: number,
  now: Date = new Date(),
): { start: Date; end: Date } {
  const year = now.getUTCFullYear();
  const tryStart = new Date(
    Date.UTC(year, yearStartMonth - 1, yearStartDay, 0, 0, 0, 0),
  );
  // If we're before this year's anchor, the active cycle started last
  // year — adjust by one.
  const startYear = now.getTime() < tryStart.getTime() ? year - 1 : year;
  const start = new Date(
    Date.UTC(startYear, yearStartMonth - 1, yearStartDay, 0, 0, 0, 0),
  );
  const end = new Date(
    Date.UTC(startYear + 1, yearStartMonth - 1, yearStartDay, 0, 0, 0, 0),
  );
  return { start, end };
}

// Compute "used" + "pending" stay nights inside the active cycle so
// the owner UI can show "X of Y days used".
export async function computeQuotaStatus(
  propertyId: string,
  now: Date = new Date(),
): Promise<QuotaStatus | null> {
  const quota = await prisma.ownerStayQuota.findUnique({
    where: { propertyId },
  });
  if (!quota || quota.daysPerYear <= 0) return null;
  const { start, end } = currentCycleBounds(
    quota.yearStartMonth,
    quota.yearStartDay,
    now,
  );
  // We only count requests whose checkIn falls inside the cycle.
  // Anything else belongs to a different cycle (or already accounted
  // for in last year's). Status filter keeps cancelled / rejected
  // requests from inflating the usage.
  const rows = await prisma.ownerReservationRequest.findMany({
    where: {
      propertyId,
      status: { in: ["APPROVED", "PENDING"] },
      checkIn: { gte: start, lt: end },
    },
    select: { status: true, nights: true },
  });
  let usedNights = 0;
  let pendingNights = 0;
  for (const r of rows) {
    if (r.status === "APPROVED") usedNights += r.nights;
    else if (r.status === "PENDING") pendingNights += r.nights;
  }
  return {
    daysPerYear: quota.daysPerYear,
    cycleStart: start,
    cycleEnd: end,
    usedNights,
    pendingNights,
    remainingNights: Math.max(
      0,
      quota.daysPerYear - usedNights - pendingNights,
    ),
  };
}

// Helper used in actions to validate "is this request within quota?"
// Returns null when OK, or a human-readable error message otherwise.
export async function validateAgainstQuota(input: {
  propertyId: string;
  checkIn: Date;
  checkOut: Date;
  ignoreRequestId?: string;
}): Promise<string | null> {
  const quota = await prisma.ownerStayQuota.findUnique({
    where: { propertyId: input.propertyId },
  });
  if (!quota) return "No stay quota is configured for this property.";
  if (quota.daysPerYear <= 0) return "Stay quota for this property is 0.";
  if (input.checkOut.getTime() <= input.checkIn.getTime()) {
    return "Check-out must be after check-in.";
  }
  const nights = Math.max(
    1,
    Math.round(
      (input.checkOut.getTime() - input.checkIn.getTime()) / (86400000),
    ),
  );
  const { start, end } = currentCycleBounds(
    quota.yearStartMonth,
    quota.yearStartDay,
    new Date(),
  );
  if (input.checkIn.getTime() < start.getTime()) {
    return "Check-in must fall within the current quota year.";
  }
  if (input.checkOut.getTime() > end.getTime()) {
    return "Check-out must fall within the current quota year.";
  }
  // Count everything else (APPROVED + PENDING) inside the cycle.
  const existing = await prisma.ownerReservationRequest.findMany({
    where: {
      propertyId: input.propertyId,
      status: { in: ["APPROVED", "PENDING"] },
      checkIn: { gte: start, lt: end },
      ...(input.ignoreRequestId ? { id: { not: input.ignoreRequestId } } : {}),
    },
    select: { nights: true },
  });
  const used = existing.reduce((s, r) => s + r.nights, 0);
  if (used + nights > quota.daysPerYear) {
    return `Quota exceeded: ${used} + ${nights} > ${quota.daysPerYear}.`;
  }
  return null;
}
