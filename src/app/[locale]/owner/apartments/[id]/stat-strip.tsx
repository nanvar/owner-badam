"use client";

import { Coins, CalendarCheck, Bed, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { StaggerList, StaggerItem } from "@/components/ui/motion";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/config";

type Stat = {
  label: string;
  value: number;
  formatAsCurrency?: boolean;
  accent: "indigo" | "sky" | "emerald" | "amber";
};

const accentClasses: Record<Stat["accent"], string> = {
  indigo: "from-indigo-500/15 to-indigo-500/0 text-indigo-500",
  sky: "from-sky-500/15 to-sky-500/0 text-sky-500",
  emerald: "from-emerald-500/15 to-emerald-500/0 text-emerald-500",
  amber: "from-amber-500/15 to-amber-500/0 text-amber-500",
};

export function StatStrip({
  locale,
  revenue,
  bookings,
  nights,
  adr,
  labels,
}: {
  locale: Locale;
  revenue: number;
  bookings: number;
  nights: number;
  adr: number;
  labels: { revenue: string; bookings: string; nights: string; adr: string };
}) {
  const stats: { stat: Stat; icon: React.ReactNode }[] = [
    {
      stat: { label: labels.revenue, value: revenue, formatAsCurrency: true, accent: "indigo" },
      icon: <Coins className="h-4 w-4" />,
    },
    {
      stat: { label: labels.bookings, value: bookings, accent: "sky" },
      icon: <CalendarCheck className="h-4 w-4" />,
    },
    {
      stat: { label: labels.nights, value: nights, accent: "emerald" },
      icon: <Bed className="h-4 w-4" />,
    },
    {
      stat: { label: labels.adr, value: adr, formatAsCurrency: true, accent: "amber" },
      icon: <TrendingUp className="h-4 w-4" />,
    },
  ];

  return (
    <StaggerList className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map(({ stat, icon }) => (
        <StaggerItem key={stat.label}>
          <Card className="overflow-hidden transition-shadow hover:shadow-md">
            <div className={cn("bg-gradient-to-br p-5", accentClasses[stat.accent])}>
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium uppercase tracking-wider opacity-80">
                  {stat.label}
                </div>
                <div className="opacity-80">{icon}</div>
              </div>
              <div className="mt-2 text-2xl font-bold text-[var(--color-foreground)]">
                {stat.formatAsCurrency ? (
                  <AnimatedNumber
                    value={stat.value}
                    format={(v) => formatCurrency(v, "AED", locale)}
                  />
                ) : (
                  <AnimatedNumber value={stat.value} />
                )}
              </div>
            </div>
          </Card>
        </StaggerItem>
      ))}
    </StaggerList>
  );
}
