"use client";

// Photos / Documents / History tabs on the property detail page.
// Each tab is independent — admin can upload photos to the gallery,
// drop documents (contracts, deeds, NOCs), and log timeline events
// (renovations, inspections, condition notes).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Image as ImageIcon,
  FileText,
  History,
  Plus,
  Trash2,
  Loader2,
  X,
  Star,
  Wrench,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Field, Textarea } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { S3Uploader, type UploadedFile } from "@/components/ui/s3-uploader";
import { cn, formatDate } from "@/lib/utils";
import {
  recordPropertyMediaAction,
  deletePropertyMediaAction,
  setPropertyCoverAction,
} from "@/app/actions/property-media";
import {
  upsertPropertyEventAction,
  deletePropertyEventAction,
} from "@/app/actions/property-events";
import type {
  AdminPhoto,
  DocumentItem,
  EventItem,
} from "./property-detail-view";

type Tab = "photos" | "documents" | "history";

function fmtBytes(n: number | null) {
  if (!n) return "";
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / 1024 / 1024).toFixed(1) + " MB";
}

export function PropertyMediaPanel({
  propertyId,
  coverPhotoUrl,
  adminPhotos,
  documents,
  events,
  locale,
}: {
  propertyId: string;
  coverPhotoUrl: string | null;
  adminPhotos: AdminPhoto[];
  documents: DocumentItem[];
  events: EventItem[];
  locale: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("photos");
  const [pending, startTx] = useTransition();
  const [eventDraft, setEventDraft] = useState<EventItem | null | undefined>(
    undefined,
  );

  const persistMedia = async (u: UploadedFile, kind: "PHOTO" | "DOCUMENT") => {
    await recordPropertyMediaAction({
      propertyId,
      kind,
      url: u.publicUrl,
      fileName: u.fileName,
      fileSize: u.fileSize,
      mimeType: u.mimeType,
    });
    router.refresh();
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-1 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/40 px-2 py-2">
        <TabButton
          active={tab === "photos"}
          onClick={() => setTab("photos")}
          icon={<ImageIcon className="h-3.5 w-3.5" />}
          count={adminPhotos.length}
        >
          Photos
        </TabButton>
        <TabButton
          active={tab === "documents"}
          onClick={() => setTab("documents")}
          icon={<FileText className="h-3.5 w-3.5" />}
          count={documents.length}
        >
          Documents
        </TabButton>
        <TabButton
          active={tab === "history"}
          onClick={() => setTab("history")}
          icon={<History className="h-3.5 w-3.5" />}
          count={events.length}
        >
          Visit log
        </TabButton>
      </div>

      <div className="p-3">
        {tab === "photos" && (
          <div className="space-y-3">
            <S3Uploader
              scope="property-photo"
              scopeId={propertyId}
              accept="image/*"
              multiple
              values={[]}
              onValuesChange={(arr) => {
                // We persist each upload eagerly as it lands so the
                // uploader's local "values" array stays empty.
                arr.forEach((u) => {
                  persistMedia(u, "PHOTO").catch(() => undefined);
                });
              }}
              label="Upload photos"
              hint="JPG / PNG / WEBP — multiple files supported"
            />
            {adminPhotos.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--color-border)] px-4 py-8 text-center text-xs text-[var(--color-muted)]">
                No admin-uploaded photos yet.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {adminPhotos.map((p) => {
                  const isCover = p.url === coverPhotoUrl;
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "group relative overflow-hidden rounded-xl border bg-white",
                        isCover
                          ? "border-amber-500"
                          : "border-[var(--color-border)]",
                      )}
                    >
                      <div className="aspect-square w-full">
                        <img
                          src={p.url}
                          alt={p.title ?? ""}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      {isCover && (
                        <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                          <Star className="h-2.5 w-2.5" />
                          Cover
                        </span>
                      )}
                      <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        {!isCover && (
                          <button
                            type="button"
                            title="Set as cover"
                            disabled={pending}
                            onClick={() =>
                              startTx(async () => {
                                await setPropertyCoverAction({
                                  propertyId,
                                  mediaId: p.id,
                                });
                                router.refresh();
                              })
                            }
                            className="grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white hover:bg-black/75"
                          >
                            <Star className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          title="Delete"
                          disabled={pending}
                          onClick={() => {
                            if (!confirm("Delete this photo?")) return;
                            startTx(async () => {
                              await deletePropertyMediaAction(p.id);
                              router.refresh();
                            });
                          }}
                          className="grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white hover:bg-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "documents" && (
          <div className="space-y-3">
            <S3Uploader
              scope="property-document"
              scopeId={propertyId}
              accept=".pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/*"
              multiple
              values={[]}
              onValuesChange={(arr) => {
                arr.forEach((u) => {
                  persistMedia(u, "DOCUMENT").catch(() => undefined);
                });
              }}
              label="Upload documents"
              hint="Contracts, deeds, NOCs, insurance papers…"
            />
            {documents.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--color-border)] px-4 py-8 text-center text-xs text-[var(--color-muted)]">
                No documents uploaded yet.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] bg-white">
                {documents.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center gap-3 px-3 py-2.5"
                  >
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--color-surface-2)] text-[var(--color-muted)]">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-sm font-medium hover:text-[var(--color-brand)]"
                      >
                        {d.fileName || d.title || d.url.split("/").pop()}
                      </a>
                      <div className="text-[11px] text-[var(--color-muted)]">
                        {fmtBytes(d.fileSize)}
                        {d.fileSize ? " · " : ""}
                        {formatDate(d.createdAt, locale)}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (!confirm("Delete this document?")) return;
                        startTx(async () => {
                          await deletePropertyMediaAction(d.id);
                          router.refresh();
                        });
                      }}
                      aria-label="Delete"
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--color-muted)] hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "history" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button onClick={() => setEventDraft(null)}>
                <Plus className="h-4 w-4" />
                New event
              </Button>
            </div>
            {events.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--color-border)] px-4 py-8 text-center text-xs text-[var(--color-muted)]">
                No history entries yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {events.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-white p-3"
                  >
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-500/15 text-amber-700">
                      <Wrench className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold">
                            {e.title}
                          </div>
                          <div className="text-[11px] text-[var(--color-muted)]">
                            {e.kind} · {formatDate(e.happenedAt, locale)}
                            {e.createdByName ? ` · by ${e.createdByName}` : ""}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            if (!confirm("Delete this event?")) return;
                            startTx(async () => {
                              await deletePropertyEventAction(e.id);
                              router.refresh();
                            });
                          }}
                          aria-label="Delete"
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[var(--color-muted)] hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {e.description && (
                        <div className="mt-2 whitespace-pre-wrap text-xs text-[var(--color-foreground)]/80">
                          {e.description}
                        </div>
                      )}
                      {e.media.length > 0 && (
                        <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-5">
                          {e.media.map((m) =>
                            m.mimeType?.startsWith("image/") ? (
                              <a
                                key={m.id}
                                href={m.url}
                                target="_blank"
                                rel="noreferrer"
                                className="aspect-square overflow-hidden rounded-md"
                              >
                                <img
                                  src={m.url}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              </a>
                            ) : (
                              <a
                                key={m.id}
                                href={m.url}
                                target="_blank"
                                rel="noreferrer"
                                className="grid aspect-square place-items-center rounded-md bg-[var(--color-surface-2)] text-[var(--color-muted)]"
                              >
                                <FileText className="h-5 w-5" />
                              </a>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <EventEditor
        key={eventDraft === undefined ? "ev-closed" : eventDraft?.id ?? "ev-new"}
        open={eventDraft !== undefined}
        propertyId={propertyId}
        event={eventDraft ?? null}
        onClose={() => setEventDraft(undefined)}
      />
    </Card>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-white text-[var(--color-foreground)] shadow-sm"
          : "text-[var(--color-muted)] hover:bg-white/60 hover:text-[var(--color-foreground)]",
      )}
    >
      {icon}
      {children}
      <span
        className={cn(
          "rounded-full px-1.5 text-[10px] font-bold",
          active
            ? "bg-[var(--color-brand-soft)] text-[var(--color-brand)]"
            : "bg-[var(--color-surface-2)] text-[var(--color-muted)]",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function EventEditor({
  open,
  event,
  propertyId,
  onClose,
}: {
  open: boolean;
  event: EventItem | null;
  propertyId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTx] = useTransition();
  const [kind, setKind] = useState(event?.kind ?? "VISIT");
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [happenedAt, setHappenedAt] = useState(
    event?.happenedAt
      ? event.happenedAt.slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  );
  const [photos, setPhotos] = useState<UploadedFile[]>([]);
  const [docs, setDocs] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    setError(null);
    if (!title.trim()) {
      setError("Headline is required");
      return;
    }
    startTx(async () => {
      try {
        // Persist every uploaded file as PropertyMedia and collect
        // their ids so the event upsert can link them. Photos use the
        // EVENT_PHOTO kind so they render inline in the timeline; doc
        // attachments keep DOCUMENT so the owner can download them.
        const photoIds: string[] = [];
        for (const p of photos) {
          const m = await recordPropertyMediaAction({
            propertyId,
            kind: "EVENT_PHOTO",
            url: p.publicUrl,
            fileName: p.fileName,
            fileSize: p.fileSize,
            mimeType: p.mimeType,
          });
          photoIds.push(m.id);
        }
        for (const d of docs) {
          const m = await recordPropertyMediaAction({
            propertyId,
            kind: "DOCUMENT",
            url: d.publicUrl,
            fileName: d.fileName,
            fileSize: d.fileSize,
            mimeType: d.mimeType,
          });
          photoIds.push(m.id);
        }
        await upsertPropertyEventAction({
          id: event?.id,
          propertyId,
          kind,
          title,
          description,
          happenedAt: new Date(happenedAt).toISOString(),
          photoIds,
        });
        router.refresh();
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
      }
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={event ? "Edit log entry" : "New visit / log entry"}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date of visit" htmlFor="event-date">
            <Input
              id="event-date"
              type="date"
              value={happenedAt}
              onChange={(e) => setHappenedAt(e.target.value)}
            />
          </Field>
          <Field label="Type" htmlFor="event-kind" hint="What kind of update is this?">
            <select
              id="event-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="h-11 w-full rounded-xl border-2 border-[var(--color-border)] bg-white px-3 text-sm font-medium"
            >
              {[
                ["VISIT", "Site visit"],
                ["INSPECTION", "Inspection"],
                ["MAINTENANCE", "Maintenance"],
                ["RENOVATION", "Renovation"],
                ["FURNISHING", "Furnishing"],
                ["DAMAGE", "Damage / issue"],
                ["PHOTOGRAPHY", "Photography"],
                ["NOTE", "Note"],
                ["OTHER", "Other"],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Headline" htmlFor="event-title" hint="What happened?">
          <Input
            id="event-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Supervisor visit · checked water leak"
            required
            maxLength={255}
          />
        </Field>
        <Field
          label="Notes"
          htmlFor="event-desc"
          hint="Detailed notes for the owner — what was observed, who did what, follow-ups."
        >
          <Textarea
            id="event-desc"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the visit, observations, work done, costs incurred, follow-up actions…"
          />
        </Field>
        <Field
          label="Photos"
          hint="Snapshots from the visit — owner sees these inline in the timeline."
        >
          <S3Uploader
            scope="property-event-photo"
            scopeId={propertyId}
            accept="image/*"
            multiple
            values={photos}
            onValuesChange={setPhotos}
            label=""
          />
        </Field>
        <Field
          label="Documents / files"
          hint="Inspection reports, invoices, receipts — anything you'd like the owner to download."
        >
          <S3Uploader
            scope="property-document"
            scopeId={propertyId}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,image/*,application/pdf"
            multiple
            values={docs}
            onValuesChange={setDocs}
            label=""
          />
        </Field>
        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" loading={pending} onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
