import { Skeleton } from "@/components/ui/skeleton";

export default function ApartmentsLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-48" rounded="rounded-lg" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" rounded="rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
