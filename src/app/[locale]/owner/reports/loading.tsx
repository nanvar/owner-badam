import { Skeleton } from "@/components/ui/skeleton";

export default function ReportsLoading() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-40" rounded="rounded-lg" />
        <Skeleton className="h-9 w-28" rounded="rounded-xl" />
      </div>
      <div className="-mx-4 overflow-x-auto px-4 no-scrollbar">
        <div className="flex gap-2 pb-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-8 w-24 shrink-0"
              rounded="rounded-full"
            />
          ))}
        </div>
      </div>
      <Skeleton className="h-11 w-full" rounded="rounded-xl" />

      <div className="flex gap-2 rounded-xl border border-[var(--color-border)] bg-white p-1">
        <Skeleton className="h-9 flex-1" rounded="rounded-lg" />
        <Skeleton className="h-9 flex-1" rounded="rounded-lg" />
        <Skeleton className="h-9 flex-1" rounded="rounded-lg" />
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-white p-5 space-y-3">
        <Skeleton className="h-5 w-44" rounded="rounded-md" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between border-b border-[var(--color-border)] pb-3 last:border-0 last:pb-0"
          >
            <Skeleton className="h-4 w-32" rounded="rounded-md" />
            <Skeleton className="h-5 w-20" rounded="rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
