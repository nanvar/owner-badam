import { Skeleton } from "@/components/ui/skeleton";

export default function AdminPropertiesLoading() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-40" rounded="rounded-lg" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" rounded="rounded-xl" />
          <Skeleton className="h-9 w-32" rounded="rounded-xl" />
        </div>
      </div>
      <div className="rounded-2xl border border-[var(--color-border)] bg-white">
        <Skeleton className="h-12 w-full rounded-t-2xl" rounded="rounded-none" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-t border-[var(--color-border)] px-4 py-3"
          >
            <Skeleton className="h-8 w-1" rounded="rounded-full" />
            <Skeleton className="h-5 flex-1" rounded="rounded-md" />
            <Skeleton className="h-5 w-24" rounded="rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
