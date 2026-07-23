import { setRequestLocale } from "next-intl/server";
import { Fragment } from "react";
import { isLocale } from "@/i18n/config";
import { notFound } from "next/navigation";
import {
  TrendingUp,
  Wallet,
  Receipt,
  PiggyBank,
  AlertCircle,
  CalendarPlus,
  Users,
  CalendarDays,
  Banknote,
  HandCoins,
  ChevronDown,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/app-shell";

// Company dashboard — design scaffold. Numbers are STATIC placeholders for now;
// the data layer gets wired back in a later pass. The point of this file is the
// KPI card set + layout, so everything below is presentation only.

type Accent = "emerald" | "rose" | "sky" | "amber" | "indigo";

const ACCENT: Record<
  Accent,
  { grad: string; ring: string; label: string; iconBg: string }
> = {
  emerald: {
    grad: "from-emerald-50 to-white dark:from-emerald-950/30 dark:to-transparent",
    ring: "ring-emerald-100 dark:ring-emerald-900/40",
    label: "text-emerald-700 dark:text-emerald-400",
    iconBg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
  },
  rose: {
    grad: "from-rose-50 to-white dark:from-rose-950/30 dark:to-transparent",
    ring: "ring-rose-100 dark:ring-rose-900/40",
    label: "text-rose-600 dark:text-rose-400",
    iconBg: "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400",
  },
  sky: {
    grad: "from-sky-50 to-white dark:from-sky-950/30 dark:to-transparent",
    ring: "ring-sky-100 dark:ring-sky-900/40",
    label: "text-sky-700 dark:text-sky-400",
    iconBg: "bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-400",
  },
  amber: {
    grad: "from-amber-50 to-white dark:from-amber-950/30 dark:to-transparent",
    ring: "ring-amber-100 dark:ring-amber-900/40",
    label: "text-amber-700 dark:text-amber-400",
    iconBg: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
  },
  indigo: {
    grad: "from-indigo-50 to-white dark:from-indigo-950/30 dark:to-transparent",
    ring: "ring-indigo-100 dark:ring-indigo-900/40",
    label: "text-indigo-700 dark:text-indigo-400",
    iconBg: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400",
  },
};

function StatCard({
  label,
  meta,
  value,
  footnote,
  accent,
  icon: Icon,
}: {
  label: string;
  meta?: string;
  value: string;
  footnote?: string;
  accent: Accent;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const a = ACCENT[accent];
  return (
    <div
      className={`flex h-full flex-col rounded-2xl bg-linear-to-br p-4 shadow-sm ring-1 ${a.grad} ${a.ring}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`text-[11px] font-semibold uppercase tracking-wider ${a.label}`}>
          {label}
          {meta && <span className="opacity-60"> · {meta}</span>}
        </p>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${a.iconBg}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold tabular-nums text-foreground">
        {value}
      </p>
      {footnote && (
        <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted">
          {footnote}
        </p>
      )}
    </div>
  );
}

function MultiStatCard({
  label,
  accent,
  icon: Icon,
  stats,
}: {
  label: string;
  accent: Accent;
  icon: React.ComponentType<{ className?: string }>;
  stats: { label: string; value: string }[];
}) {
  const a = ACCENT[accent];
  return (
    <div
      className={`flex h-full flex-col rounded-2xl bg-linear-to-br p-4 shadow-sm ring-1 ${a.grad} ${a.ring}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`text-[11px] font-semibold uppercase tracking-wider ${a.label}`}>
          {label}
        </p>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${a.iconBg}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="mt-3 flex items-end">
        {stats.map((s, i) => (
          <Fragment key={s.label}>
            {i > 0 && <span className="mx-1 h-8 w-px self-center bg-current opacity-10" />}
            <div className="flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                {s.label}
              </p>
              <p className="text-xl font-bold tabular-nums text-foreground">
                {s.value}
              </p>
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

export default async function SuperAdminDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  await requireRole("SUPERADMIN");

  return (
    <div>
      <PageHeader
        title="Dashboard"
        right={
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3.5 py-2 text-sm font-medium text-foreground shadow-sm dark:bg-transparent"
          >
            All months
            <ChevronDown className="h-4 w-4 opacity-50" />
          </button>
        }
      />

      {/* Row 1 — company money */}
      <div className="grid auto-rows-fr grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Company revenue" value="AED 73,776" accent="emerald" icon={TrendingUp} />
        <StatCard label="Company profit" value="AED 7,260" accent="emerald" icon={Wallet} />
        <StatCard label="Company expenses" value="AED 66,516" accent="rose" icon={Receipt} />
        <StatCard label="Active deposits" value="AED 13,100" accent="sky" icon={PiggyBank} />
      </div>

      {/* Row 2 — operations */}
      <div className="mt-3 grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Unpaid" meta="0" value="AED 0" accent="rose" icon={AlertCircle} />
        <StatCard
          label="Pending extensions"
          value="0"
          footnote="All priced"
          accent="amber"
          icon={CalendarPlus}
        />
        <StatCard
          label="Owner payout"
          meta="5 owners"
          value="AED 54,260"
          accent="indigo"
          icon={Users}
        />
        <MultiStatCard
          label="Reservations"
          accent="amber"
          icon={CalendarDays}
          stats={[
            { label: "All", value: "32" },
            { label: "Live", value: "4" },
            { label: "Done", value: "28" },
            { label: "Ext", value: "3" },
          ]}
        />
      </div>

      {/* Row 3 — owner ledger */}
      <div className="mt-3 grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Investments"
          meta="3 in · 18 out"
          value="AED 0"
          accent="emerald"
          icon={Banknote}
        />
        <StatCard
          label="Owner debts"
          meta="0 pending"
          value="AED 0"
          accent="indigo"
          icon={HandCoins}
        />
        <StatCard
          label="Paid to owner"
          meta="8 payments"
          value="AED 37,177"
          accent="emerald"
          icon={HandCoins}
        />
      </div>
    </div>
  );
}
