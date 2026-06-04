// Daily background jobs. Two trigger paths share this code:
//   1. A cron service hitting /api/cron/daily (recommended for prod).
//   2. The admin layout firing runDailyJobs() on first request each day
//      (fallback so the system is self-healing without external cron).
//
// Idempotency: each job key + UTC date is unique in DailyJobRun. The
// first trigger to claim the row wins; the rest see "already-ran".

import { prisma } from "./prisma";
import { notify, NotificationType } from "./notify";

type JobResult = Record<string, unknown> & { skipped?: number; ran?: number };
type JobFn = () => Promise<JobResult>;

// UTC day key — keeps the "did we run today?" question simple and
// independent of server TZ.
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function sameUtcDay(a: Date, b: Date): boolean {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

// ============================================================
// Job: service charge reminders. For every UPCOMING/REMINDING
// instance whose dueDate is inside its schedule's reminder window,
// push the owner a "check your email" notification once a day.
// ============================================================
async function serviceChargeReminders(): Promise<JobResult> {
  const now = new Date();
  // Pull only candidates that might need a reminder soon. We filter
  // by status server-side and finish the date math in JS to keep the
  // query simple.
  const candidates = await prisma.serviceChargeInstance.findMany({
    where: { status: { in: ["UPCOMING", "REMINDING"] } },
    include: {
      property: {
        select: {
          id: true,
          name: true,
          ownerId: true,
          serviceCharge: {
            select: { reminderDaysBefore: true, active: true },
          },
        },
      },
    },
  });

  let reminded = 0;
  let skipped = 0;
  for (const inst of candidates) {
    const sched = inst.property.serviceCharge;
    if (!sched || !sched.active) {
      skipped++;
      continue;
    }
    const dueMs = inst.dueDate.getTime();
    const windowStart = dueMs - sched.reminderDaysBefore * 86400000;
    // Within the reminder window? (and not >30 days past due — avoid
    // pestering forever)
    if (now.getTime() < windowStart) {
      skipped++;
      continue;
    }
    if (now.getTime() > dueMs + 30 * 86400000) {
      skipped++;
      continue;
    }
    // Already nagged today?
    if (inst.lastReminderAt && sameUtcDay(inst.lastReminderAt, now)) {
      skipped++;
      continue;
    }
    // Send + bump status + stamp lastReminderAt.
    const due = inst.dueDate.toISOString().slice(0, 10);
    await notify({
      userId: inst.property.ownerId,
      type: NotificationType.SERVICE_CHARGE_DUE,
      title: `Service charge due · ${inst.property.name}`,
      body: `Bill due ${due}. Check your email for the official notice.`,
      url: "/owner",
      data: {
        propertyId: inst.property.id,
        instanceId: inst.id,
        dueDate: inst.dueDate.toISOString(),
      },
    });
    await prisma.serviceChargeInstance.update({
      where: { id: inst.id },
      data: { status: "REMINDING", lastReminderAt: now },
    });
    reminded++;
  }
  return { reminded, skipped };
}

// ============================================================
// Job: service charge rollover. After an instance is marked PAID we
// need a fresh UPCOMING instance for the next cycle. We also catch
// schedules that have NO instances yet (admin just enabled it).
// ============================================================
async function serviceChargeRollover(): Promise<JobResult> {
  const schedules = await prisma.serviceChargeSchedule.findMany({
    where: { active: true },
    include: {
      property: {
        select: {
          id: true,
          serviceInstances: {
            select: { id: true, dueDate: true, status: true },
            orderBy: { dueDate: "desc" },
          },
        },
      },
    },
  });

  let created = 0;
  for (const s of schedules) {
    const instances = s.property.serviceInstances;
    const hasUpcoming = instances.some(
      (i) => i.status !== "PAID" && i.dueDate.getTime() >= Date.now(),
    );
    if (hasUpcoming) continue;

    // Compute the next dueDate. Start from latest known instance OR
    // from firstDueDate. Step forward by frequencyMonths until the
    // date is in the future.
    const latest = instances[0]; // already sorted desc
    let next = latest ? new Date(latest.dueDate) : new Date(s.firstDueDate);
    const safetyCap = 240; // 20 years worth of monthly steps
    let i = 0;
    while (next.getTime() <= Date.now() && i < safetyCap) {
      next.setMonth(next.getMonth() + s.frequencyMonths);
      i++;
    }
    // De-dupe on (propertyId, dueDate). Cheap upsert.
    try {
      await prisma.serviceChargeInstance.create({
        data: { propertyId: s.propertyId, dueDate: next, status: "UPCOMING" },
      });
      created++;
    } catch {
      // Unique violation — already there. Ignore.
    }
  }
  return { created };
}

// Registry. Add new jobs here and they automatically participate in
// both cron + admin-login triggering.
const DAILY_JOBS: Record<string, JobFn> = {
  serviceChargeReminders,
  serviceChargeRollover,
};

export async function runDailyJobs(
  trigger: "cron" | "admin-login" | "manual",
): Promise<{ trigger: string; date: string; jobs: Record<string, unknown> }> {
  const date = todayKey();
  const jobs: Record<string, unknown> = {};

  for (const [key, fn] of Object.entries(DAILY_JOBS)) {
    // Claim the slot. If the unique constraint blows up, somebody
    // else already ran this job today.
    let runId: string | null = null;
    try {
      const claimed = await prisma.dailyJobRun.create({
        data: { jobKey: key, runDate: date, trigger },
        select: { id: true },
      });
      runId = claimed.id;
    } catch {
      jobs[key] = "already-ran";
      continue;
    }
    try {
      const result = await fn();
      await prisma.dailyJobRun.update({
        where: { id: runId },
        data: {
          finishedAt: new Date(),
          result: result as Parameters<
            typeof prisma.dailyJobRun.update
          >[0]["data"]["result"],
        },
      });
      jobs[key] = result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await prisma.dailyJobRun.update({
        where: { id: runId },
        data: { finishedAt: new Date(), error: msg },
      });
      jobs[key] = { error: msg };
    }
  }
  return { trigger, date, jobs };
}

// Lightweight gate the admin layout calls — non-blocking, swallows
// errors so a slow job never delays a page render. Returns nothing
// because the layout doesn't care about the result.
let _adminBootRanFor: string | null = null;
export function fireAdminDailyJobsInBackground(): void {
  const date = todayKey();
  // Per-process memo so we don't even attempt the DB roundtrip more
  // than once per day per server instance. The DB unique constraint
  // is the real source of truth across instances.
  if (_adminBootRanFor === date) return;
  _adminBootRanFor = date;
  void runDailyJobs("admin-login").catch((err) => {
    console.error("[daily-jobs] admin-login trigger failed:", err);
    // Reset the memo so a later request can retry.
    _adminBootRanFor = null;
  });
}
