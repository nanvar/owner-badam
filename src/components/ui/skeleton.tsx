import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  rounded = "rounded-xl",
}: {
  className?: string;
  rounded?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-[var(--color-surface-2)]",
        rounded,
        className,
      )}
    >
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/60 to-transparent shimmer" />
    </div>
  );
}
