"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Calendar, User2, X, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

type Owner = { id: string; name: string };

export function ReportingFilter({
  owners,
  ownerId,
  from,
  to,
  basePath,
}: {
  owners: Owner[];
  ownerId: string;
  from: string;
  to: string;
  basePath: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const hasActive = !!(ownerId || from || to);

  const submit = (form: HTMLFormElement) => {
    const fd = new FormData(form);
    const params = new URLSearchParams();
    const o = (fd.get("ownerId") as string) || "";
    const f = (fd.get("from") as string) || "";
    const t = (fd.get("to") as string) || "";
    if (o) params.set("ownerId", o);
    if (f) params.set("from", f);
    if (t) params.set("to", t);
    const qs = params.toString();
    start(() => {
      router.push(qs ? `${basePath}?${qs}` : basePath);
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(e.currentTarget);
      }}
      className="mb-4 rounded-2xl border-2 border-[var(--color-border)] bg-white p-4 shadow-sm"
    >
      <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
        <Filter className="h-3.5 w-3.5" />
        Filter
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <Field label="Owner" icon={<User2 className="h-3.5 w-3.5" />}>
          <select
            name="ownerId"
            defaultValue={ownerId}
            className="h-10 w-full bg-transparent text-sm font-medium focus:outline-none"
          >
            <option value="">All owners</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date range" icon={<Calendar className="h-3.5 w-3.5" />}>
          <div className="flex flex-1 items-center gap-1">
            <input
              type="date"
              name="from"
              defaultValue={from}
              aria-label="From"
              className="h-10 flex-1 bg-transparent text-sm font-medium focus:outline-none"
            />
            <span className="text-xs text-[var(--color-muted)]">→</span>
            <input
              type="date"
              name="to"
              defaultValue={to}
              aria-label="To"
              className="h-10 flex-1 bg-transparent text-sm font-medium focus:outline-none"
            />
          </div>
        </Field>
        <div className="flex items-end gap-2">
          <Button type="submit" loading={pending}>
            Apply
          </Button>
          {hasActive && (
            <button
              type="button"
              onClick={() =>
                start(() => {
                  router.push(basePath);
                })
              }
              className="inline-flex h-10 items-center gap-1 rounded-xl border-2 border-[var(--color-border)] bg-white px-3 text-sm font-medium text-[var(--color-muted)] transition-colors hover:border-[var(--color-brand)] hover:text-[var(--color-foreground)]"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        {icon}
        {label}
      </span>
      <span className="flex items-center gap-1 rounded-xl border-2 border-[var(--color-border)] bg-white px-3 transition-colors focus-within:border-[var(--color-brand)] focus-within:ring-[3px] focus-within:ring-[var(--color-brand)]/20 hover:border-[var(--color-border-strong,#cbd5d3)]">
        {children}
      </span>
    </label>
  );
}
