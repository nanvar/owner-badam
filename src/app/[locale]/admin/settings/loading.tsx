import { Skeleton } from "@/components/ui/skeleton";

export default function AdminSettingsLoading() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-32" rounded="rounded-lg" />
        <Skeleton className="h-9 w-24" rounded="rounded-xl" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-[var(--color-border)] bg-white p-5 space-y-4"
        >
          <Skeleton className="h-5 w-32" rounded="rounded-md" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-11 w-full" rounded="rounded-xl" />
            <Skeleton className="h-11 w-full" rounded="rounded-xl" />
            <Skeleton className="h-11 w-full" rounded="rounded-xl" />
            <Skeleton className="h-11 w-full" rounded="rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}
