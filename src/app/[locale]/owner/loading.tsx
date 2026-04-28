import { Skeleton } from "@/components/ui/skeleton";

export default function OwnerDashboardLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-56" rounded="rounded-lg" />

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

      <Skeleton className="h-48 w-full" rounded="rounded-3xl" />

      <Skeleton className="h-72 w-full" rounded="rounded-2xl" />

      <div className="space-y-3">
        <Skeleton className="h-5 w-40" rounded="rounded-md" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" rounded="rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
