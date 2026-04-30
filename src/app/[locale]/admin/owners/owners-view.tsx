"use client";

import { useActionState, useState, useTransition } from "react";
import {
  Plus,
  User,
  Building2,
  Edit3,
  Trash2,
  ChevronRight,
  Ban,
  Unlock,
} from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Field } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { PageHeader } from "@/components/app-shell";
import {
  createOwnerAction,
  updateOwnerAction,
  deleteOwnerAction,
  setUserBlockedAction,
} from "@/app/actions/properties";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type OwnerRow = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  taxId: string | null;
  address: string | null;
  blocked: boolean;
  createdAt: string;
  propertyCount: number;
};

export function OwnersView({
  owners,
  labels,
}: {
  owners: OwnerRow[];
  labels: Record<string, string>;
}) {
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [editing, setEditing] = useState<OwnerRow | null>(null);
  const [deleting, setDeleting] = useState<OwnerRow | null>(null);

  const [createState, createAction, createPending] = useActionState<
    { status: string; message?: string } | undefined,
    FormData
  >(createOwnerAction, undefined);

  const [updateState, updateAction, updatePending] = useActionState<
    { status: string; message?: string } | undefined,
    FormData
  >(updateOwnerAction, undefined);

  const [deletePending, startDelete] = useTransition();
  const [blockPending, startBlock] = useTransition();
  const [pendingBlockId, setPendingBlockId] = useState<string | null>(null);
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) ?? "en";
  const goToOwner = (id: string) => router.push(`/${locale}/admin/owners/${id}`);

  if (createState?.status === "ok" && creatingOpen) {
    queueMicrotask(() => setCreatingOpen(false));
  }
  if (updateState?.status === "ok" && editing) {
    queueMicrotask(() => setEditing(null));
  }

  return (
    <div>
      <PageHeader
        title={labels.title}
        right={
          <Button onClick={() => setCreatingOpen(true)}>
            <Plus className="h-4 w-4" />
            {labels.newOwner}
          </Button>
        }
      />
      {owners.length === 0 ? (
        <Card className="grid place-items-center px-6 py-14 text-sm text-[var(--color-muted)]">
          No owners yet — click <strong className="ml-1 text-[var(--color-foreground)]">{labels.newOwner}</strong>.
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface-2)] text-xs uppercase tracking-wider text-[var(--color-muted)]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">{labels.ownerName}</th>
                  <th className="px-4 py-3 text-left font-semibold">{labels.ownerEmail}</th>
                  <th className="px-4 py-3 text-right font-semibold">
                    <Building2 className="-mt-0.5 mr-1 inline h-3.5 w-3.5" />
                    {labels.properties ?? "Properties"}
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">{labels.actions ?? ""}</th>
                </tr>
              </thead>
              <tbody>
                {owners.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => goToOwner(o.id)}
                    className="cursor-pointer border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]/60"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                            o.blocked
                              ? "bg-rose-500/10 text-rose-600"
                              : "bg-[var(--color-brand-soft)] text-[var(--color-brand)]",
                          )}
                        >
                          <User className="h-4 w-4" />
                        </span>
                        <div>
                          <div className="font-semibold">{o.name ?? "—"}</div>
                          {o.blocked && (
                            <Badge tone="danger" className="mt-1">
                              <Ban className="h-3 w-3" />
                              Blocked
                            </Badge>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">{o.email}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {o.propertyCount}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setPendingBlockId(o.id);
                            startBlock(async () => {
                              await setUserBlockedAction(o.id, !o.blocked);
                              setPendingBlockId(null);
                            });
                          }}
                          disabled={blockPending && pendingBlockId === o.id}
                          aria-label={o.blocked ? "Unblock" : "Block"}
                          title={o.blocked ? "Unblock" : "Block"}
                          className={cn(
                            "rounded-lg p-1.5 transition-colors disabled:opacity-50",
                            o.blocked
                              ? "text-emerald-600 hover:bg-emerald-500/10"
                              : "text-[var(--color-muted)] hover:bg-amber-500/10 hover:text-amber-600",
                          )}
                        >
                          {o.blocked ? (
                            <Unlock className="h-4 w-4" />
                          ) : (
                            <Ban className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => setEditing(o)}
                          aria-label="Edit"
                          className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-foreground)]"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleting(o)}
                          aria-label="Delete"
                          className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-rose-500/10 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <ChevronRight className="ml-1 h-4 w-4 text-[var(--color-muted)]" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Sheet
        open={creatingOpen}
        onClose={() => setCreatingOpen(false)}
        title={labels.createOwner}
      >
        <form action={createAction} className="space-y-4">
          <Field label={labels.ownerName} htmlFor="c-name">
            <Input id="c-name" name="name" required placeholder="Ahmad" />
          </Field>
          <Field label={labels.ownerEmail} htmlFor="c-email">
            <Input id="c-email" name="email" type="email" required placeholder="owner@example.com" />
          </Field>
          <Field label={labels.ownerPassword} htmlFor="c-password">
            <Input id="c-password" name="password" type="password" required minLength={4} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={labels.ownerPhone} htmlFor="c-phone">
              <Input id="c-phone" name="phone" placeholder="+971 …" />
            </Field>
            <Field label={labels.ownerTaxId} htmlFor="c-taxId">
              <Input id="c-taxId" name="taxId" placeholder="TC…" />
            </Field>
          </div>
          <Field label={labels.ownerAddress} htmlFor="c-address">
            <Input id="c-address" name="address" placeholder="Dubai, UAE" />
          </Field>
          {createState?.status === "error" && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600">
              {createState.message}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreatingOpen(false)}>
              {labels.cancel}
            </Button>
            <Button type="submit" loading={createPending}>
              {labels.createOwner}
            </Button>
          </div>
        </form>
      </Sheet>

      <Sheet
        open={!!editing}
        onClose={() => setEditing(null)}
        title={labels.editOwner ?? "Edit owner"}
      >
        {editing && (
          <form action={updateAction} className="space-y-4">
            <input type="hidden" name="id" value={editing.id} />
            <Field label={labels.ownerName} htmlFor="e-name">
              <Input id="e-name" name="name" required defaultValue={editing.name ?? ""} />
            </Field>
            <Field label={labels.ownerEmail} htmlFor="e-email">
              <Input id="e-email" name="email" type="email" required defaultValue={editing.email} />
            </Field>
            <Field
              label={labels.ownerPassword}
              htmlFor="e-password"
              hint={labels.passwordHint ?? "Leave empty to keep current password"}
            >
              <Input id="e-password" name="password" type="password" minLength={4} placeholder="••••••••" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={labels.ownerPhone} htmlFor="e-phone">
                <Input id="e-phone" name="phone" defaultValue={editing.phone ?? ""} placeholder="+971 …" />
              </Field>
              <Field label={labels.ownerTaxId} htmlFor="e-taxId">
                <Input id="e-taxId" name="taxId" defaultValue={editing.taxId ?? ""} placeholder="TC…" />
              </Field>
            </div>
            <Field label={labels.ownerAddress} htmlFor="e-address">
              <Input id="e-address" name="address" defaultValue={editing.address ?? ""} placeholder="Dubai, UAE" />
            </Field>
            {updateState?.status === "error" && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600">
                {updateState.message}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                {labels.cancel}
              </Button>
              <Button type="submit" loading={updatePending}>
                {labels.save}
              </Button>
            </div>
          </form>
        )}
      </Sheet>

      <Sheet
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={labels.delete}
      >
        {deleting && (
          <>
            <p className="text-sm text-[var(--color-muted)]">
              {labels.deleteOwnerConfirm ??
                "Are you sure? This will remove the owner and all their properties and reservations."}
            </p>
            <div className="mt-3 rounded-xl bg-[var(--color-surface-2)] p-3 text-sm">
              <div className="font-semibold">{deleting.name ?? deleting.email}</div>
              <div className="text-xs text-[var(--color-muted)]">{deleting.email}</div>
              <div className="mt-1 text-xs">
                <Building2 className="-mt-0.5 mr-1 inline h-3 w-3" />
                {deleting.propertyCount} properties
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDeleting(null)}>
                {labels.cancel}
              </Button>
              <Button
                variant="danger"
                loading={deletePending}
                onClick={() =>
                  startDelete(async () => {
                    await deleteOwnerAction(deleting.id);
                    setDeleting(null);
                  })
                }
              >
                <Trash2 className="h-4 w-4" />
                {labels.delete}
              </Button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}
