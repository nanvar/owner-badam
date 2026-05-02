"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteOwnerReportAction } from "@/app/actions/owner-reports";

export function DeleteReportButton({
  id,
  locale,
}: {
  id: string;
  locale: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      loading={pending}
      onClick={() =>
        start(async () => {
          if (
            !confirm(
              "Delete this report? Reservations and expenses will be released back into the picker.",
            )
          )
            return;
          await deleteOwnerReportAction(id);
          router.push(`/${locale}/admin/reports`);
        })
      }
      className="text-rose-500 hover:bg-rose-500/10"
    >
      <Trash2 className="h-4 w-4" />
      Delete
    </Button>
  );
}
