"use client";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import * as React from "react";

export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  side = "bottom",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  side?: "bottom" | "right";
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-50 flex"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" />
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative z-10 flex w-full flex-col bg-[var(--color-surface)] shadow-2xl animate-fade-in",
          side === "bottom"
            ? "mt-auto max-h-[92dvh] rounded-t-3xl sm:mx-auto sm:my-auto sm:max-w-lg sm:rounded-3xl"
            : "ml-auto h-full w-full max-w-md rounded-l-3xl md:max-w-3xl",
        )}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div>
            {title && (
              <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            )}
            {description && (
              <p className="mt-0.5 text-sm text-[var(--color-muted)]">
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="-m-1 rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-foreground)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {footer && (
          <div className="border-t border-[var(--color-border)] bg-[var(--color-surface-2)]/50 px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
