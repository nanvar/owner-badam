"use client";

// Settings panel listing every NotificationType as a toggle row,
// grouped by area. Save is per-row (no submit button) so the
// optimistic toggle UX matches phone notification settings.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { updateNotificationPrefsAction } from "@/app/actions/user-prefs";
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_GROUP_LABEL,
  type NotificationCategory,
  type NotificationGroup,
} from "@/lib/notification-categories";
import type { NotificationTypeKey } from "@/lib/notification-types";

export function NotificationSettingsForm({
  initialPrefs,
}: {
  initialPrefs: Record<NotificationTypeKey, boolean>;
}) {
  const router = useRouter();
  const [prefs, setPrefs] =
    useState<Record<NotificationTypeKey, boolean>>(initialPrefs);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [, startTx] = useTransition();

  const toggle = (key: NotificationTypeKey, next: boolean) => {
    const prev = prefs[key];
    if (prev === next) return;
    setPrefs((p) => ({ ...p, [key]: next }));
    setSavingKey(key);
    startTx(async () => {
      try {
        await updateNotificationPrefsAction({ [key]: next });
        setSavedKey(key);
        setTimeout(() => {
          setSavedKey((current) => (current === key ? null : current));
        }, 1200);
      } catch {
        // Roll back optimistic toggle on failure.
        setPrefs((p) => ({ ...p, [key]: prev }));
      } finally {
        setSavingKey((current) => (current === key ? null : current));
        router.refresh();
      }
    });
  };

  // Group categories for tidy rendering.
  const groups = new Map<NotificationGroup, NotificationCategory[]>();
  for (const c of NOTIFICATION_CATEGORIES) {
    if (!groups.has(c.group)) groups.set(c.group, []);
    groups.get(c.group)!.push(c);
  }

  return (
    <div className="space-y-4">
      {Array.from(groups.entries()).map(([groupKey, cats]) => (
        <Card key={groupKey}>
          <CardBody className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              <Bell className="h-4 w-4" />
              {NOTIFICATION_GROUP_LABEL[groupKey]}
            </div>
            <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] bg-white">
              {cats.map((c) => {
                const on = prefs[c.type] ?? c.defaultOn;
                const saving = savingKey === c.type;
                const saved = savedKey === c.type;
                return (
                  <li
                    key={c.type}
                    className="flex items-center gap-3 px-3 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{c.label}</div>
                      <div className="text-xs text-[var(--color-muted)]">
                        {c.description}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin text-[var(--color-muted)]" />
                      ) : saved ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : null}
                      <button
                        type="button"
                        onClick={() => toggle(c.type, !on)}
                        role="switch"
                        aria-checked={on}
                        className={cn(
                          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                          on ? "bg-emerald-500" : "bg-[var(--color-surface-2)]",
                        )}
                      >
                        <span
                          className={cn(
                            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform",
                            on ? "translate-x-5" : "translate-x-0",
                          )}
                        />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
