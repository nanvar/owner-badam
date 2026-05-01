"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardBody } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { Locale } from "@/i18n/config";

export type PropertyBar = {
  name: string;
  color: string;
  agencyEarnings: number;
};

export type MonthlyPoint = {
  label: string; // e.g. "Oct 2025"
  agency: number;
  expenses: number;
  net: number;
};

export type SplitSlice = {
  label: string;
  value: number;
  color: string;
};

const fmt = (n: number, locale: Locale) => formatCurrency(n, "AED", locale);
const compactFmt = (n: number) =>
  Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n)}`;

export function DashboardCharts({
  locale,
  topProperties,
  split,
  monthly,
}: {
  locale: Locale;
  topProperties: PropertyBar[];
  split: SplitSlice[];
  monthly: MonthlyPoint[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {/* Top properties — bar */}
      <Card className="overflow-hidden xl:col-span-1">
        <CardBody>
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-sm font-bold tracking-tight">
              Top properties
            </h3>
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
              Company earnings
            </span>
          </div>
          {topProperties.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={topProperties}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
              >
                <CartesianGrid horizontal={false} stroke="#eef2f0" />
                <XAxis
                  type="number"
                  tickFormatter={compactFmt}
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  stroke="#cbd5d3"
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fill: "#334155", fontSize: 11 }}
                  stroke="#cbd5d3"
                />
                <Tooltip
                  formatter={(v) => fmt(Number(v) || 0, locale)}
                  cursor={{ fill: "rgba(79,138,111,0.06)" }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e2e8e6",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="agencyEarnings" radius={[0, 6, 6, 0]}>
                  {topProperties.map((p, i) => (
                    <Cell key={i} fill={p.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardBody>
      </Card>

      {/* Revenue split — donut */}
      <Card className="overflow-hidden">
        <CardBody>
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-sm font-bold tracking-tight">
              Where the money goes
            </h3>
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
              All-time split
            </span>
          </div>
          {split.every((s) => s.value === 0) ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={split}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={56}
                  outerRadius={86}
                  paddingAngle={2}
                  stroke="white"
                  strokeWidth={2}
                >
                  {split.map((s, i) => (
                    <Cell key={i} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => fmt(Number(v) || 0, locale)}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e2e8e6",
                    fontSize: 12,
                  }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11 }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardBody>
      </Card>

      {/* Monthly net profit — line */}
      <Card className="overflow-hidden xl:col-span-1">
        <CardBody>
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-sm font-bold tracking-tight">
              Net profit, last 12 months
            </h3>
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
              Revenue − expenses
            </span>
          </div>
          {monthly.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart
                data={monthly}
                margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
              >
                <CartesianGrid stroke="#eef2f0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  stroke="#cbd5d3"
                />
                <YAxis
                  tickFormatter={compactFmt}
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  stroke="#cbd5d3"
                />
                <Tooltip
                  formatter={(v) => fmt(Number(v) || 0, locale)}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e2e8e6",
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="agency"
                  name="Revenue"
                  stroke="#4f8a6f"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#4f8a6f" }}
                />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  name="Expenses"
                  stroke="#e11d48"
                  strokeWidth={2}
                  dot={{ r: 2.5, fill: "#e11d48" }}
                />
                <Line
                  type="monotone"
                  dataKey="net"
                  name="Net"
                  stroke="#0f172a"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#0f172a" }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="grid h-[260px] place-items-center text-sm text-[var(--color-muted)]">
      Not enough data yet
    </div>
  );
}
