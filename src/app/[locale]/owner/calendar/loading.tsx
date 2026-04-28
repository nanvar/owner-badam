import { Skeleton } from "@/components/ui/skeleton";

export default function CalendarLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-40" rounded="rounded-lg" />
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-11 w-40" rounded="rounded-2xl" />
        <Skeleton className="h-5 flex-1 min-w-32" rounded="rounded-md" />
        <Skeleton className="h-11 w-28" rounded="rounded-2xl" />
      </div>
      <Skeleton className="h-[520px] w-full" rounded="rounded-2xl" />
    </div>
  );
}
