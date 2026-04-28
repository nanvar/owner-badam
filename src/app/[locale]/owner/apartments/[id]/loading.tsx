import { Skeleton } from "@/components/ui/skeleton";

export default function ApartmentDetailLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-4 w-32" rounded="rounded-md" />
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-1 items-center gap-3">
          <Skeleton className="h-11 w-11 shrink-0" rounded="rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-48" rounded="rounded-md" />
            <Skeleton className="h-3 w-32" rounded="rounded-md" />
          </div>
        </div>
        <Skeleton className="h-9 w-24" rounded="rounded-xl" />
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

      <Skeleton className="h-44 w-full" rounded="rounded-3xl" />

      <div className="space-y-3">
        <Skeleton className="h-5 w-32" rounded="rounded-md" />
        <Skeleton className="h-80 w-full" rounded="rounded-2xl" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-10 w-full" rounded="rounded-2xl" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" rounded="rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
