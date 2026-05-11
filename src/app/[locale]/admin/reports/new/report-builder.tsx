"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Calendar, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input, Field, Textarea } from "@/components/ui/input";
import {
  createOwnerReportAction,
  type ReportState,
} from "@/app/actions/owner-reports";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Locale } from "@/i18n/config";

type Property = {
  id: string;
  name: string;
  color: string;
  ownerName: string;
};

type Reservation = {
  id: string;
  externalId: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  guestName: string | null;
  totalPrice: number;
  payout: number;
  currency: string;
  monthKey: string | null;
};

type Extension = {
  id: string;
  reservationId: string;
  parentExternalId: string | null;
  parentGuestName: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  totalPrice: number;
  payout: number;
  currency: string;
  monthKey: string | null;
};

type Expense = {
  id: string;
  date: string;
  type: string;
  description: string;
  amount: number;
  monthKey: string | null;
};

// Unified row type so reservations and extensions render in one table —
// owners and admins look at a single chronological list of bookings.
type BookingRow =
  | {
      kind: "reservation";
      id: string;
      externalId: string | null;
      guestName: string | null;
      checkIn: string;
      checkOut: string;
      nights: number;
      payout: number;
      currency: string;
      monthKey: string | null;
    }
  | {
      kind: "extension";
      id: string;
      externalId: string | null;
      guestName: string | null;
      checkIn: string;
      checkOut: string;
      nights: number;
      payout: number;
      currency: string;
      monthKey: string | null;
    };

export function ReportBuilder({
  locale,
  currentMonthKey,
  properties,
  selectedPropertyId,
  reservations,
  extensions,
  expenses,
}: {
  locale: Locale;
  currentMonthKey: string;
  properties: Property[];
  selectedPropertyId: string | null;
  reservations: Reservation[];
  extensions: Extension[];
  expenses: Expense[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"reservations" | "expenses">("reservations");
  const [pickedRes, setPickedRes] = useState<Set<string>>(
    () => new Set(reservations.filter((r) => r.monthKey === currentMonthKey).map((r) => r.id)),
  );
  const [pickedExt, setPickedExt] = useState<Set<string>>(
    () => new Set(extensions.filter((e) => e.monthKey === currentMonthKey).map((e) => e.id)),
  );
  const [pickedExp, setPickedExp] = useState<Set<string>>(
    () => new Set(expenses.filter((e) => e.monthKey === currentMonthKey).map((e) => e.id)),
  );
  const [name, setName] = useState("");

  const [state, action, pending] = useActionState<
    ReportState | undefined,
    FormData
  >(createOwnerReportAction, undefined);

  useEffect(() => {
    if (state?.status === "ok") {
      router.push(`/${locale}/admin/reports/${state.reportId}`);
    }
  }, [state, router, locale]);

  const selected = properties.find((p) => p.id === selectedPropertyId) ?? null;
  const filteredProps = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return properties;
    return properties.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.ownerName.toLowerCase().includes(q),
    );
  }, [properties, search]);

  // Merged + chronological booking list for the Reservations tab.
  // Extensions surface alongside reservations as separate bookings,
  // matching the owner-report convention.
  const bookings = useMemo<BookingRow[]>(() => {
    const all: BookingRow[] = [
      ...reservations.map((r) => ({
        kind: "reservation" as const,
        id: r.id,
        externalId: r.externalId,
        guestName: r.guestName,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        nights: r.nights,
        payout: r.payout,
        currency: r.currency,
        monthKey: r.monthKey,
      })),
      ...extensions.map((e) => ({
        kind: "extension" as const,
        id: e.id,
        externalId: e.parentExternalId,
        guestName: e.parentGuestName,
        checkIn: e.checkIn,
        checkOut: e.checkOut,
        nights: e.nights,
        payout: e.payout,
        currency: e.currency,
        monthKey: e.monthKey,
      })),
    ];
    return all.sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  }, [reservations, extensions]);

  const onChooseProperty = (id: string) => {
    setPickedRes(new Set());
    setPickedExt(new Set());
    setPickedExp(new Set());
    router.push(`/${locale}/admin/reports/new?propertyId=${id}`);
  };

  const isPicked = (row: BookingRow) =>
    row.kind === "reservation" ? pickedRes.has(row.id) : pickedExt.has(row.id);
  const togglePicked = (row: BookingRow) => {
    if (row.kind === "reservation") {
      const next = new Set(pickedRes);
      if (next.has(row.id)) next.delete(row.id);
      else next.add(row.id);
      setPickedRes(next);
    } else {
      const next = new Set(pickedExt);
      if (next.has(row.id)) next.delete(row.id);
      else next.add(row.id);
      setPickedExt(next);
    }
  };
  const toggleExp = (id: string) => {
    const next = new Set(pickedExp);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPickedExp(next);
  };

  const totalIncome =
    reservations
      .filter((r) => pickedRes.has(r.id))
      .reduce((s, r) => s + r.payout, 0) +
    extensions
      .filter((e) => pickedExt.has(e.id))
      .reduce((s, e) => s + e.payout, 0);
  const totalExpenses = expenses
    .filter((e) => pickedExp.has(e.id))
    .reduce((s, e) => s + e.amount, 0);
  const net = totalIncome - totalExpenses;

  const canSubmit =
    !!selected &&
    !!name.trim() &&
    pickedRes.size + pickedExt.size + pickedExp.size > 0;

  const bookingsAllPicked =
    bookings.length > 0 && bookings.every((row) => isPicked(row));
  const togglePickedAll = (on: boolean) => {
    if (on) {
      setPickedRes(new Set(reservations.map((r) => r.id)));
      setPickedExt(new Set(extensions.map((e) => e.id)));
    } else {
      setPickedRes(new Set());
      setPickedExt(new Set());
    }
  };

  if (!selected) {
    return (
      <Card>
        <CardBody>
          <div className="mb-3 text-sm font-medium">Choose a property</div>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
            <Input
              placeholder="Search by property or owner"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {filteredProps.length === 0 ? (
            <div className="py-10 text-center text-sm text-[var(--color-muted)]">
              No properties match your search.
            </div>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {filteredProps.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onChooseProperty(p.id)}
                    className="flex w-full items-center gap-3 rounded-2xl border-2 border-[var(--color-border)] bg-white px-3 py-2.5 text-left transition-colors hover:border-[var(--color-brand)]"
                  >
                    <span
                      className="h-9 w-1.5 shrink-0 rounded-full"
                      style={{ background: p.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{p.name}</div>
                      <div className="truncate text-xs text-[var(--color-muted)]">
                        {p.ownerName}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="propertyId" value={selected.id} />
      {Array.from(pickedRes).map((id) => (
        <input key={id} type="hidden" name="reservationIds" value={id} />
      ))}
      {Array.from(pickedExt).map((id) => (
        <input key={id} type="hidden" name="extensionIds" value={id} />
      ))}
      {Array.from(pickedExp).map((id) => (
        <input key={id} type="hidden" name="expenseIds" value={id} />
      ))}

      <Card>
        <CardBody>
          <div className="flex items-center gap-3">
            <span
              className="h-10 w-1.5 rounded-full"
              style={{ background: selected.color }}
            />
            <div>
              <div className="font-semibold">{selected.name}</div>
              <div className="text-xs text-[var(--color-muted)]">
                {selected.ownerName}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Report name" htmlFor="report-name">
              <Input
                id="report-name"
                name="name"
                placeholder="March 2026"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
              />
            </Field>
            <Field label="Notes (optional)" htmlFor="report-notes">
              <Textarea
                id="report-notes"
                name="notes"
                placeholder="Any context about this settlement…"
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      <div className="flex rounded-2xl border border-[var(--color-border)] bg-white p-1">
        {(
          [
            {
              key: "reservations",
              label: "Reservations",
              icon: Calendar,
              count: bookings.length,
            },
            {
              key: "expenses",
              label: "Expenses",
              icon: Receipt,
              count: expenses.length,
            },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-[var(--color-brand)] text-white"
                : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            <span
              className={`rounded-full px-1.5 text-[10px] font-bold ${
                tab === t.key
                  ? "bg-white/25 text-white"
                  : "bg-[var(--color-surface-2)] text-[var(--color-muted)]"
              }`}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {tab === "reservations" ? (
        bookings.length === 0 ? (
          <Card>
            <CardBody className="py-10 text-center text-sm text-[var(--color-muted)]">
              No open reservations for this property. Items already in another
              report don't show here.
            </CardBody>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="grid-table w-full text-sm">
                <thead className="bg-[var(--color-surface-2)] text-xs uppercase tracking-wider text-[var(--color-muted)]">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        aria-label="select all"
                        checked={bookingsAllPicked}
                        onChange={(e) => togglePickedAll(e.target.checked)}
                      />
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">Guest</th>
                    <th className="px-4 py-3 text-left font-semibold">Airbnb ID</th>
                    <th className="px-4 py-3 text-left font-semibold">Stay</th>
                    <th className="px-4 py-3 text-left font-semibold">Bill</th>
                    <th className="px-4 py-3 text-right font-semibold">Nights</th>
                    <th className="px-4 py-3 text-right font-semibold">Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((row) => {
                    const checked = isPicked(row);
                    const inMonth = row.monthKey === currentMonthKey;
                    return (
                      <tr
                        key={`${row.kind}-${row.id}`}
                        onClick={() => togglePicked(row)}
                        className={`cursor-pointer border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]/60 ${
                          checked ? "bg-emerald-500/5" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePicked(row)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <span className="block">
                            {row.guestName ?? "—"}
                          </span>
                          {row.kind === "extension" && (
                            <span className="mt-0.5 inline-flex items-center rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-700">
                              Extension
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[var(--color-muted)]">
                          {row.externalId ?? "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-[var(--color-muted)]">
                          {formatDate(row.checkIn, locale)} →{" "}
                          {formatDate(row.checkOut, locale)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <MonthBadge
                            monthKey={row.monthKey}
                            highlight={inMonth}
                          />
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {row.nights}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">
                          {formatCurrency(row.payout, row.currency, locale)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )
      ) : expenses.length === 0 ? (
        <Card>
          <CardBody className="py-10 text-center text-sm text-[var(--color-muted)]">
            No open expenses for this property.
          </CardBody>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="grid-table w-full text-sm">
              <thead className="bg-[var(--color-surface-2)] text-xs uppercase tracking-wider text-[var(--color-muted)]">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      aria-label="select all"
                      checked={
                        expenses.length > 0 &&
                        expenses.every((e) => pickedExp.has(e.id))
                      }
                      onChange={(e) => {
                        if (e.target.checked)
                          setPickedExp(new Set(expenses.map((x) => x.id)));
                        else setPickedExp(new Set());
                      }}
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Type</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Bill</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => {
                  const checked = pickedExp.has(e.id);
                  const inMonth = e.monthKey === currentMonthKey;
                  return (
                    <tr
                      key={e.id}
                      onClick={() => toggleExp(e.id)}
                      className={`cursor-pointer border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]/60 ${
                        checked ? "bg-rose-500/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleExp(e.id)}
                          onClick={(ev) => ev.stopPropagation()}
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatDate(e.date, locale)}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">
                        {e.type}
                      </td>
                      <td className="px-4 py-3 line-clamp-2">{e.description}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <MonthBadge
                          monthKey={e.monthKey}
                          highlight={inMonth}
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-rose-600">
                        {formatCurrency(e.amount, "AED", locale)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="sticky bottom-2 z-10">
        <Card className="overflow-hidden shadow-lg">
          <CardBody>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex flex-1 flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
                <span>
                  <span className="text-[var(--color-muted)]">Income</span>{" "}
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(totalIncome, "AED", locale)}
                  </span>
                </span>
                <span>
                  <span className="text-[var(--color-muted)]">Expenses</span>{" "}
                  <span className="font-semibold tabular-nums text-rose-600">
                    {formatCurrency(totalExpenses, "AED", locale)}
                  </span>
                </span>
                <span>
                  <span className="text-[var(--color-muted)]">Net</span>{" "}
                  <span
                    className={`text-base font-bold tabular-nums ${net >= 0 ? "text-emerald-700" : "text-rose-600"}`}
                  >
                    {formatCurrency(net, "AED", locale)}
                  </span>
                </span>
                <span className="text-xs text-[var(--color-muted)]">
                  {pickedRes.size + pickedExt.size} bookings ·{" "}
                  {pickedExp.size} expenses
                </span>
              </div>
              {state?.status === "error" && (
                <div className="w-full text-sm text-rose-600">
                  {state.message}
                </div>
              )}
              <Button type="submit" disabled={!canSubmit} loading={pending}>
                Create report
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </form>
  );
}

// Compact monthKey chip — visually highlighted when it matches the
// current billing month so admins can spot the rows that the default
// auto-check covers.
function MonthBadge({
  monthKey,
  highlight,
}: {
  monthKey: string | null;
  highlight: boolean;
}) {
  if (!monthKey) {
    return (
      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
        —
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
        highlight
          ? "bg-emerald-500/15 text-emerald-700"
          : "bg-[var(--color-surface-2)] text-[var(--color-muted)]"
      }`}
    >
      {monthKey}
    </span>
  );
}
