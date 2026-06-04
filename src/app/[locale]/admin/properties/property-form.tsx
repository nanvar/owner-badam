"use client";

// Dedicated full-page property form. Used by both /admin/properties/new
// (create) and /admin/properties/[id]/edit. Replaces the older Sheet
// modal so we have room for the cover-photo S3 upload + future fields.

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field, Textarea } from "@/components/ui/input";
import { Card, CardBody } from "@/components/ui/card";
import { S3Uploader, type UploadedFile } from "@/components/ui/s3-uploader";
import { upsertPropertyAction, type PropertyState } from "@/app/actions/properties";

export type PropertyFormValue = {
  id?: string;
  name: string;
  address: string | null;
  airbnbIcalUrl: string | null;
  airbnbUrl: string | null;
  color: string;
  notes: string | null;
  managementOnly: boolean;
  coverPhotoUrl: string | null;
  ownerId: string;
  createdAt?: string | null;
};

export type OwnerOption = { id: string; name: string | null; email: string };

export function PropertyForm({
  initial,
  owners,
  locale,
}: {
  initial?: PropertyFormValue;
  owners: OwnerOption[];
  locale: string;
}) {
  const router = useRouter();
  const isEdit = !!initial?.id;
  const [state, action, pending] = useActionState<
    PropertyState | undefined,
    FormData
  >(upsertPropertyAction, undefined);
  const [managementOnly, setManagementOnly] = useState<boolean>(
    initial?.managementOnly ?? false,
  );
  const [cover, setCover] = useState<UploadedFile | null>(
    initial?.coverPhotoUrl
      ? {
          publicUrl: initial.coverPhotoUrl,
          key: "",
          fileName: "cover",
          fileSize: 0,
          mimeType: "image/*",
        }
      : null,
  );

  useEffect(() => {
    if (state?.status === "ok") {
      // After save, jump back to the property list. Caller routes to
      // detail page from there.
      router.push(`/${locale}/admin/properties`);
      router.refresh();
    }
  }, [state, router, locale]);

  return (
    <div className="space-y-4">
      <Link
        href={`/${locale}/admin/properties`}
        className="inline-flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
      >
        <ArrowLeft className="h-4 w-4" />
        All properties
      </Link>

      <h1 className="text-2xl font-bold">
        {isEdit ? "Edit property" : "Add property"}
      </h1>

      <form action={action} className="space-y-4">
        {initial?.id && <input type="hidden" name="id" value={initial.id} />}

        <Card>
          <CardBody className="space-y-4">
            <Field label="Name" htmlFor="name">
              <Input
                id="name"
                name="name"
                required
                maxLength={120}
                defaultValue={initial?.name ?? ""}
                placeholder="Marina 2BR"
              />
            </Field>
            <Field label="Address" htmlFor="address">
              <Input
                id="address"
                name="address"
                maxLength={255}
                defaultValue={initial?.address ?? ""}
                placeholder="Dubai Marina, Tower 5"
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Owner" htmlFor="ownerId">
                <select
                  id="ownerId"
                  name="ownerId"
                  required
                  defaultValue={initial?.ownerId ?? owners[0]?.id ?? ""}
                  className="h-11 w-full rounded-xl border-2 border-[var(--color-border)] bg-white px-3 text-sm font-medium"
                >
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name ?? o.email}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Color" htmlFor="color">
                <Input
                  id="color"
                  name="color"
                  type="color"
                  defaultValue={initial?.color ?? "#4f8a6f"}
                  className="h-11 w-full rounded-xl p-1"
                />
              </Field>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Airbnb (optional)
            </h2>
            <Field
              label="Airbnb iCal URL"
              htmlFor="airbnbIcalUrl"
              hint="Airbnb → Calendar → Export → copy iCal link"
            >
              <Input
                id="airbnbIcalUrl"
                name="airbnbIcalUrl"
                type="url"
                defaultValue={initial?.airbnbIcalUrl ?? ""}
                placeholder="https://www.airbnb.com/calendar/ical/..."
              />
            </Field>
            <Field
              label="Airbnb listing URL"
              htmlFor="airbnbUrl"
              hint="Used to import photos & details"
            >
              <Input
                id="airbnbUrl"
                name="airbnbUrl"
                type="url"
                defaultValue={initial?.airbnbUrl ?? ""}
                placeholder="https://www.airbnb.com/rooms/..."
              />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Cover & flags
            </h2>
            {/* Manual cover photo — handy for management-only homes
                that aren't on Airbnb. Uploaded straight to S3. */}
            <Field
              label="Cover photo"
              hint="Used when the Airbnb gallery is empty"
            >
              <S3Uploader
                scope="property-cover"
                scopeId={initial?.id}
                accept="image/*"
                value={cover}
                onChange={setCover}
                label=""
              />
              <input
                type="hidden"
                name="coverPhotoUrl"
                value={cover?.publicUrl ?? ""}
              />
            </Field>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[var(--color-border)] bg-white px-3 py-2.5">
              <input
                type="checkbox"
                checked={managementOnly}
                onChange={(e) => setManagementOnly(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-indigo-600"
              />
              <span className="flex-1">
                <span className="block text-sm font-medium">
                  Management only — not rented out
                </span>
                <span className="block text-xs text-[var(--color-muted)]">
                  Hides revenue KPIs and unlocks stay-quota + service
                  charge tracking for this property.
                </span>
              </span>
            </label>
            <input
              type="hidden"
              name="managementOnly"
              value={managementOnly ? "true" : "false"}
            />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Internal
            </h2>
            <Field
              label="Added on"
              htmlFor="createdAt"
              hint="Drives the months available in the owner's reports"
            >
              <Input
                id="createdAt"
                name="createdAt"
                type="date"
                defaultValue={
                  initial?.createdAt ? initial.createdAt.slice(0, 10) : ""
                }
                max={new Date().toISOString().slice(0, 10)}
              />
            </Field>
            <Field label="Notes" htmlFor="notes">
              <Textarea
                id="notes"
                name="notes"
                rows={4}
                defaultValue={initial?.notes ?? ""}
                placeholder="Wi-Fi codes, building access, internal notes…"
              />
            </Field>
          </CardBody>
        </Card>

        {state?.status === "error" && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600">
            {state.message}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Link
            href={`/${locale}/admin/properties`}
            className="rounded-xl px-4 py-2 text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-foreground)]"
          >
            Cancel
          </Link>
          <Button type="submit" loading={pending}>
            {isEdit ? "Save changes" : "Create property"}
          </Button>
        </div>
      </form>
    </div>
  );
}
