"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { deleteOwnerReportAction } from "@/app/actions/owner-reports";

export function DeleteReportButton({
  id,
  name,
  locale,
}: {
  id: string;
  name: string;
  locale: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();
  // Trim both sides — easy to miss a trailing space when copying the name.
  const matches = typed.trim() === name.trim();

  const onDelete = () =>
    start(async () => {
      await deleteOwnerReportAction(id);
      router.push(`/${locale}/admin/reports`);
    });

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => {
          setTyped("");
          setOpen(true);
        }}
        className="text-rose-500 hover:bg-rose-500/10"
      >
        <Trash2 className="h-4 w-4" />
        Delete
      </Button>

      <Sheet
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="Delete this report?"
        description="Reservations and expenses will be released back into the picker."
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-700">
            Type the report name <strong>{name}</strong> to confirm.
          </div>
          <Field label="Report name" htmlFor="confirm-name">
            <Input
              id="confirm-name"
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={name}
              disabled={pending}
            />
          </Field>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onDelete}
              disabled={!matches || pending}
              loading={pending}
              className="bg-rose-500 hover:bg-rose-600"
            >
              <Trash2 className="h-4 w-4" />
              Delete report
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
