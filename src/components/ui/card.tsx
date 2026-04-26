import { cn } from "@/lib/utils";
import * as React from "react";

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm shadow-black/[0.02] dark:shadow-none",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-5 pt-5 pb-2", className)}>
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <h3 className={cn("text-base font-semibold tracking-tight", className)}>
      {children}
    </h3>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("px-5 pb-5 pt-2", className)}>{children}</div>;
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent = "indigo",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: "indigo" | "emerald" | "amber" | "rose" | "sky";
}) {
  const map: Record<string, string> = {
    indigo: "from-indigo-500/15 to-indigo-500/0 text-indigo-500",
    emerald: "from-emerald-500/15 to-emerald-500/0 text-emerald-500",
    amber: "from-amber-500/15 to-amber-500/0 text-amber-500",
    rose: "from-rose-500/15 to-rose-500/0 text-rose-500",
    sky: "from-sky-500/15 to-sky-500/0 text-sky-500",
  };
  return (
    <Card className="overflow-hidden">
      <div className={cn("bg-gradient-to-br p-5", map[accent])}>
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium uppercase tracking-wider opacity-80">
            {label}
          </div>
          {icon && <div className="opacity-80">{icon}</div>}
        </div>
        <div className="mt-2 text-2xl font-bold text-[var(--color-foreground)]">
          {value}
        </div>
        {hint && (
          <div className="mt-1 text-xs text-[var(--color-muted)]">{hint}</div>
        )}
      </div>
    </Card>
  );
}
