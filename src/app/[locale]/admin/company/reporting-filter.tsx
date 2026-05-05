"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  const hasActive = ownerId || from || to;

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
      className="mb-3 flex flex-wrap items-end gap-2 rounded-2xl border border-[var(--color-border)] bg-white p-3"
    >
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        <Filter className="h-3.5 w-3.5" />
        Filter
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="rep-owner"
          className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]"
        >
          Owner
        </label>
        <select
          id="rep-owner"
          name="ownerId"
          defaultValue={ownerId}
          className="h-9 min-w-[180px] rounded-lg border-2 border-[var(--color-border)] bg-white px-2 text-sm font-medium focus:border-[var(--color-brand)] focus:outline-none focus:ring-[3px] focus:ring-[var(--color-brand)]/25"
        >
          <option value="">All owners</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="rep-from"
          className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]"
        >
          From
        </label>
        <Input
          id="rep-from"
          name="from"
          type="date"
          defaultValue={from}
          className="h-9 w-[150px]"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="rep-to"
          className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]"
        >
          To
        </label>
        <Input
          id="rep-to"
          name="to"
          type="date"
          defaultValue={to}
          className="h-9 w-[150px]"
        />
      </div>
      <Button type="submit" size="sm" loading={pending}>
        Apply
      </Button>
      {hasActive && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() =>
            start(() => {
              router.push(basePath);
            })
          }
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      )}
    </form>
  );
}
