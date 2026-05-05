"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Calendar, User2, X, Search } from "lucide-react";
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
      className="mb-3 flex flex-wrap items-center gap-2"
    >
      <FieldShell icon={<User2 className="h-3.5 w-3.5" />}>
        <select
          name="ownerId"
          defaultValue={ownerId}
          className="h-9 bg-transparent pr-7 pl-1 text-sm font-medium focus:outline-none"
        >
          <option value="">All owners</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </FieldShell>

      <FieldShell icon={<Calendar className="h-3.5 w-3.5" />}>
        <input
          type="date"
          name="from"
          defaultValue={from}
          aria-label="From"
          className="h-9 bg-transparent pl-1 text-sm font-medium focus:outline-none"
        />
        <span className="px-1 text-xs text-[var(--color-muted)]">→</span>
        <input
          type="date"
          name="to"
          defaultValue={to}
          aria-label="To"
          className="h-9 bg-transparent pl-1 pr-2 text-sm font-medium focus:outline-none"
        />
      </FieldShell>

      <Button type="submit" size="sm" loading={pending}>
        <Search className="h-3.5 w-3.5" />
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
          className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-medium text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-foreground)]"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </button>
      )}
    </form>
  );
}

function FieldShell({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--color-border)] bg-white px-2 transition-colors focus-within:border-[var(--color-brand)] focus-within:ring-[3px] focus-within:ring-[var(--color-brand)]/20">
      <span className="text-[var(--color-muted)]">{icon}</span>
      {children}
    </div>
  );
}
