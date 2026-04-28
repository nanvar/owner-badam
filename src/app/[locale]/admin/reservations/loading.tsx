import { Skeleton } from "@/components/ui/skeleton";

export default function AdminReservationsLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-44" rounded="rounded-lg" />
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-11 w-64" rounded="rounded-xl" />
        <Skeleton className="ml-auto h-9 w-44" rounded="rounded-xl" />
      </div>
      <div className="rounded-2xl border border-[var(--color-border)] bg-white">
        <Skeleton className="h-12 w-full rounded-t-2xl" rounded="rounded-none" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-t border-[var(--color-border)] px-4 py-3"
          >
            <Skeleton className="h-7 w-1" rounded="rounded-full" />
            <Skeleton className="h-5 w-32" rounded="rounded-md" />
            <Skeleton className="h-5 flex-1" rounded="rounded-md" />
            <Skeleton className="h-5 w-20" rounded="rounded-md" />
            <Skeleton className="h-6 w-20" rounded="rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
