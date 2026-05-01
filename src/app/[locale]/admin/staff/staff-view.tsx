"use client";

import { useActionState, useState, useTransition, useEffect } from "react";
import { Plus, User, Edit3, Trash2, Ban, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Field } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app-shell";
import { cn } from "@/lib/utils";
import {
  createStaffAction,
  updateStaffAction,
  deleteStaffAction,
  type StaffActionState,
} from "@/app/actions/staff";
import { setUserBlockedAction } from "@/app/actions/properties";

type StaffUser = {
  id: string;
  name: string | null;
  email: string;
  role: "ADMIN" | "SUPERADMIN";
  blocked: boolean;
  createdAt: string;
};

export function StaffView({
  users,
  currentUserId,
}: {
  users: StaffUser[];
  currentUserId: string;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [deleting, setDeleting] = useState<StaffUser | null>(null);
  const [deletePending, startDelete] = useTransition();
  const [blockPending, startBlock] = useTransition();
  const [pendingBlockId, setPendingBlockId] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        title="Staff"
        subtitle={
          <span className="text-sm text-[var(--color-muted)]">
            Admin and super-admin accounts. Owners are managed on the Owners
            page.
          </span>
        }
        right={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            New staff
          </Button>
        }
      />

      {users.length === 0 ? (
        <Card className="grid place-items-center px-6 py-14 text-sm text-[var(--color-muted)]">
          No staff yet.
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface-2)] text-xs uppercase tracking-wider text-[var(--color-muted)]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Email</th>
                  <th className="px-4 py-3 text-left font-semibold">Role</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = u.id === currentUserId;
                  return (
                    <tr
                      key={u.id}
                      className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]/60"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                              u.blocked
                                ? "bg-rose-500/10 text-rose-600"
                                : u.role === "SUPERADMIN"
                                  ? "bg-amber-500/15 text-amber-600"
                                  : "bg-[var(--color-brand-soft)] text-[var(--color-brand)]",
                            )}
                          >
                            <User className="h-4 w-4" />
                          </span>
                          <div>
                            <div className="font-semibold">
                              {u.name ?? "—"}
                              {isSelf && (
                                <span className="ml-2 text-[10px] text-[var(--color-muted)]">
                                  (you)
                                </span>
                              )}
                            </div>
                            {u.blocked && (
                              <Badge tone="danger" className="mt-1">
                                <Ban className="h-3 w-3" />
                                Blocked
                              </Badge>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">
                        {u.email}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          tone={u.role === "SUPERADMIN" ? "warning" : "brand"}
                        >
                          {u.role === "SUPERADMIN" ? "Super admin" : "Admin"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {!isSelf && (
                            <button
                              onClick={() => {
                                setPendingBlockId(u.id);
                                startBlock(async () => {
                                  await setUserBlockedAction(u.id, !u.blocked);
                                  setPendingBlockId(null);
                                });
                              }}
                              disabled={blockPending && pendingBlockId === u.id}
                              aria-label={u.blocked ? "Unblock" : "Block"}
                              title={u.blocked ? "Unblock" : "Block"}
                              className={cn(
                                "rounded-lg p-1.5 transition-colors disabled:opacity-50",
                                u.blocked
                                  ? "text-emerald-600 hover:bg-emerald-500/10"
                                  : "text-[var(--color-muted)] hover:bg-amber-500/10 hover:text-amber-600",
                              )}
                            >
                              {u.blocked ? (
                                <Unlock className="h-4 w-4" />
                              ) : (
                                <Ban className="h-4 w-4" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => setEditing(u)}
                            aria-label="Edit"
                            className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-foreground)]"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          {!isSelf && (
                            <button
                              onClick={() => setDeleting(u)}
                              aria-label="Delete"
                              className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-rose-500/10 hover:text-rose-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <CreateSheet open={creating} onClose={() => setCreating(false)} />
      <EditSheet
        key={editing?.id ?? "none"}
        user={editing}
        onClose={() => setEditing(null)}
      />
      <Sheet
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete staff member"
      >
        <p className="text-sm text-[var(--color-muted)]">
          Permanently remove <strong>{deleting?.name ?? deleting?.email}</strong>?
          This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={deletePending}
            onClick={() =>
              deleting &&
              startDelete(async () => {
                await deleteStaffAction(deleting.id);
                setDeleting(null);
              })
            }
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

function CreateSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<
    StaffActionState | undefined,
    FormData
  >(createStaffAction, undefined);

  useEffect(() => {
    if (state?.status === "ok") onClose();
  }, [state, onClose]);

  return (
    <Sheet open={open} onClose={onClose} title="New staff member">
      <form action={action} className="space-y-4">
        <Field label="Full name" htmlFor="c-name">
          <Input id="c-name" name="name" required placeholder="Jane Manager" />
        </Field>
        <Field label="Email" htmlFor="c-email">
          <Input
            id="c-email"
            name="email"
            type="email"
            required
            placeholder="manager@company.com"
          />
        </Field>
        <Field label="Password" htmlFor="c-password" hint="Min 6 characters">
          <Input
            id="c-password"
            name="password"
            type="password"
            required
            minLength={6}
          />
        </Field>
        <Field label="Role" htmlFor="c-role">
          <select
            id="c-role"
            name="role"
            required
            defaultValue="ADMIN"
            className="h-11 w-full rounded-xl border-2 border-[var(--color-border)] bg-white px-3 text-sm font-medium transition-colors hover:border-[#cbd5d3] focus:border-[var(--color-brand)] focus:outline-none focus:ring-[3px] focus:ring-[var(--color-brand)]/25"
          >
            <option value="ADMIN">Admin</option>
            <option value="SUPERADMIN">Super admin</option>
          </select>
        </Field>
        {state?.status === "error" && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600">
            {state.message}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={pending}>
            Create
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

function EditSheet({
  user,
  onClose,
}: {
  user: StaffUser | null;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<
    StaffActionState | undefined,
    FormData
  >(updateStaffAction, undefined);

  useEffect(() => {
    if (state?.status === "ok") onClose();
  }, [state, onClose]);

  return (
    <Sheet open={!!user} onClose={onClose} title="Edit staff member">
      {user && (
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={user.id} />
          <Field label="Full name" htmlFor="e-name">
            <Input id="e-name" name="name" required defaultValue={user.name ?? ""} />
          </Field>
          <Field label="Email" htmlFor="e-email">
            <Input
              id="e-email"
              name="email"
              type="email"
              required
              defaultValue={user.email}
            />
          </Field>
          <Field
            label="New password"
            htmlFor="e-password"
            hint="Leave empty to keep current"
          >
            <Input
              id="e-password"
              name="password"
              type="password"
              minLength={6}
            />
          </Field>
          <Field label="Role" htmlFor="e-role">
            <select
              id="e-role"
              name="role"
              required
              defaultValue={user.role}
              className="h-11 w-full rounded-xl border-2 border-[var(--color-border)] bg-white px-3 text-sm font-medium transition-colors hover:border-[#cbd5d3] focus:border-[var(--color-brand)] focus:outline-none focus:ring-[3px] focus:ring-[var(--color-brand)]/25"
            >
              <option value="ADMIN">Admin</option>
              <option value="SUPERADMIN">Super admin</option>
            </select>
          </Field>
          {state?.status === "error" && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600">
              {state.message}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Save
            </Button>
          </div>
        </form>
      )}
    </Sheet>
  );
}
