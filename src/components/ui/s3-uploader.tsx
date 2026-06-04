"use client";

// Reusable file uploader that goes through our presigned-PUT endpoint
// and streams progress via XHR. Designed to be dropped into any form:
// owner pass `value` + `onChange` to track the uploaded media; admin
// can also drop it into an admin Sheet.
//
// Single-file mode by default. multiple=true enables a drag/drop grid.

import { useId, useRef, useState } from "react";
import { Upload, X, FileText, Image as ImageIcon, Loader2, CheckCircle2, AlertCircle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export type UploadedFile = {
  publicUrl: string;
  key: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
};

export type UploadProgress = {
  /** 0..100 — overall percent for this slot */
  percent: number;
  /** local preview blob URL while uploading; null once done */
  previewUrl: string | null;
  /** local File while uploading */
  file: File | null;
  /** filled once the PUT to S3 completes */
  uploaded: UploadedFile | null;
  /** error message if upload failed */
  error: string | null;
  /** in-flight XHR — for cancel */
  xhr: XMLHttpRequest | null;
};

export type S3UploaderProps = {
  /** Server-side scope key (see ADMIN_SCOPES in /api/v1/uploads/presign). */
  scope: string;
  /** Optional id to scope the S3 key under — e.g. propertyId. */
  scopeId?: string;
  /** Accept attribute for the file picker. */
  accept?: string;
  /** Hard byte cap (also enforced server-side at 50 MB). */
  maxBytes?: number;
  /** Multi-file mode renders a grid of slots + drag/drop area. */
  multiple?: boolean;
  /** Controlled value for single-file. */
  value?: UploadedFile | null;
  onChange?: (value: UploadedFile | null) => void;
  /** Controlled value list for multi-file. */
  values?: UploadedFile[];
  onValuesChange?: (values: UploadedFile[]) => void;
  /** Label shown above the dropzone. */
  label?: string;
  /** Helper text shown beneath the dropzone. */
  hint?: string;
  /** Disable interaction (e.g. while parent form submits). */
  disabled?: boolean;
};

const DEFAULT_MAX = 50 * 1024 * 1024;

function fmtBytes(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / 1024 / 1024).toFixed(1) + " MB";
}

export function S3Uploader(props: S3UploaderProps) {
  const {
    scope,
    scopeId,
    accept,
    maxBytes = DEFAULT_MAX,
    multiple = false,
    value,
    onChange,
    values,
    onValuesChange,
    label,
    hint,
    disabled,
  } = props;
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  // In-flight uploads keyed by a local slot id so multiple files can
  // upload concurrently without competing for the same progress state.
  const [pending, setPending] = useState<Record<string, UploadProgress>>({});
  const [dragOver, setDragOver] = useState(false);

  const triggerPicker = () => inputRef.current?.click();

  const handleFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (!multiple && arr.length > 1) arr.length = 1;
    for (const file of arr) {
      if (file.size > maxBytes) {
        alert(`${file.name} exceeds ${fmtBytes(maxBytes)} limit`);
        continue;
      }
      void uploadOne(file);
    }
  };

  const uploadOne = async (file: File) => {
    const slotId =
      "slot_" + Date.now().toString(36) + "_" + Math.floor(Math.random() * 1e6).toString(36);
    const previewUrl = file.type.startsWith("image/")
      ? URL.createObjectURL(file)
      : null;
    setPending((p) => ({
      ...p,
      [slotId]: {
        percent: 0,
        previewUrl,
        file,
        uploaded: null,
        error: null,
        xhr: null,
      },
    }));

    try {
      // Step 1 — ask the server for a presigned PUT.
      const presignResp = await fetch("/api/v1/uploads/presign", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          scope,
          scopeId,
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          fileSize: file.size,
        }),
      });
      if (!presignResp.ok) {
        const txt = await presignResp.text();
        throw new Error(`presign failed: ${txt || presignResp.status}`);
      }
      const { uploadUrl, publicUrl, key } = (await presignResp.json()) as {
        uploadUrl: string;
        publicUrl: string;
        key: string;
      };

      // Step 2 — PUT to S3 directly with progress events.
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader(
          "Content-Type",
          file.type || "application/octet-stream",
        );
        xhr.upload.onprogress = (e) => {
          if (!e.lengthComputable) return;
          const pct = Math.round((e.loaded / e.total) * 100);
          setPending((p) => {
            const cur = p[slotId];
            if (!cur) return p;
            return { ...p, [slotId]: { ...cur, percent: pct } };
          });
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`S3 PUT ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error("network error"));
        setPending((p) => {
          const cur = p[slotId];
          if (!cur) return p;
          return { ...p, [slotId]: { ...cur, xhr } };
        });
        xhr.send(file);
      });

      const uploaded: UploadedFile = {
        publicUrl,
        key,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
      };

      // Step 3 — bubble up to parent via the appropriate prop.
      if (multiple) {
        onValuesChange?.([...(values ?? []), uploaded]);
      } else {
        onChange?.(uploaded);
      }

      // Mark slot as done; in multi-mode keep around briefly so user
      // sees the checkmark, then remove.
      setPending((p) => ({
        ...p,
        [slotId]: { ...p[slotId], percent: 100, uploaded, xhr: null },
      }));
      setTimeout(() => {
        setPending((p) => {
          const { [slotId]: _, ...rest } = p;
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          return rest;
        });
      }, 600);
    } catch (err) {
      const message = err instanceof Error ? err.message : "upload failed";
      setPending((p) => ({
        ...p,
        [slotId]: { ...p[slotId], error: message, xhr: null },
      }));
    }
  };

  const retry = (slotId: string) => {
    const cur = pending[slotId];
    if (!cur || !cur.file) return;
    setPending((p) => {
      const { [slotId]: _, ...rest } = p;
      if (cur.previewUrl) URL.revokeObjectURL(cur.previewUrl);
      return rest;
    });
    void uploadOne(cur.file);
  };

  const cancel = (slotId: string) => {
    const cur = pending[slotId];
    if (cur?.xhr) cur.xhr.abort();
    setPending((p) => {
      const { [slotId]: _, ...rest } = p;
      if (cur?.previewUrl) URL.revokeObjectURL(cur.previewUrl);
      return rest;
    });
  };

  const removeUploaded = (publicUrl: string) => {
    if (multiple) {
      onValuesChange?.((values ?? []).filter((v) => v.publicUrl !== publicUrl));
    } else {
      onChange?.(null);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  // ----- render -----
  const showSingleValue = !multiple && value && !Object.keys(pending).length;
  const items = multiple ? (values ?? []) : [];

  return (
    <div className="space-y-2">
      {label && (
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          {label}
        </div>
      )}

      {showSingleValue ? (
        <UploadedSingle value={value!} onRemove={() => removeUploaded(value!.publicUrl)} disabled={disabled} />
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={triggerPicker}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-white px-4 py-6 text-center transition-colors",
            dragOver
              ? "border-[var(--color-brand)] bg-[var(--color-brand)]/5"
              : "border-[var(--color-border)] hover:border-[#cbd5d3]",
            disabled && "cursor-not-allowed opacity-60",
          )}
        >
          <Upload className="h-5 w-5 text-[var(--color-muted)]" />
          <div className="text-sm font-medium">
            Drop {multiple ? "files" : "a file"} here or click to choose
          </div>
          {hint && (
            <div className="text-xs text-[var(--color-muted)]">{hint}</div>
          )}
          <div className="text-[11px] text-[var(--color-muted)]">
            Max {fmtBytes(maxBytes)} per file
          </div>
        </button>
      )}

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = ""; // reset so re-picking same file works
        }}
      />

      {/* Multi-file grid of previously uploaded items */}
      {multiple && items.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {items.map((it) => (
            <UploadedTile
              key={it.publicUrl}
              value={it}
              onRemove={() => removeUploaded(it.publicUrl)}
              disabled={disabled}
            />
          ))}
        </div>
      )}

      {/* In-flight slots */}
      {Object.entries(pending).map(([slotId, p]) => (
        <UploadingTile
          key={slotId}
          progress={p}
          onRetry={() => retry(slotId)}
          onCancel={() => cancel(slotId)}
        />
      ))}

      {/* Hidden inputs so the surrounding <form> can submit the URLs
          without extra plumbing. Single-file = one hidden input;
          multi = comma-joined or repeated inputs depending on consumer
          preference (we expose just URLs as a JSON array). */}
      {!multiple && value && (
        <>
          <input
            type="hidden"
            name={`${scope}_url`}
            value={value.publicUrl}
            readOnly
          />
          <input
            type="hidden"
            name={`${scope}_key`}
            value={value.key}
            readOnly
          />
        </>
      )}
    </div>
  );
}

// ----- subcomponents -----

function UploadedSingle({
  value,
  onRemove,
  disabled,
}: {
  value: UploadedFile;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const isImage = value.mimeType.startsWith("image/");
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-white p-3">
      {isImage ? (
        <img
          src={value.publicUrl}
          alt={value.fileName}
          className="h-14 w-14 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-[var(--color-surface-2)] text-[var(--color-muted)]">
          <FileText className="h-6 w-6" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{value.fileName}</div>
        <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
          <span>{fmtBytes(value.fileSize)}</span>
          <a
            href={value.publicUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[var(--color-brand)] hover:underline"
          >
            Open
          </a>
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label="Remove"
        className="grid h-8 w-8 place-items-center rounded-lg text-[var(--color-muted)] hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-40"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function UploadedTile({
  value,
  onRemove,
  disabled,
}: {
  value: UploadedFile;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const isImage = value.mimeType.startsWith("image/");
  return (
    <div className="group relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-white">
      <div className="aspect-square w-full">
        {isImage ? (
          <img
            src={value.publicUrl}
            alt={value.fileName}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center text-[var(--color-muted)]">
            <FileText className="h-6 w-6" />
            <div className="truncate text-[10px]">{value.fileName}</div>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label="Remove"
        className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-40"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function UploadingTile({
  progress,
  onRetry,
  onCancel,
}: {
  progress: UploadProgress;
  onRetry: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-white p-3">
      {progress.previewUrl ? (
        <img
          src={progress.previewUrl}
          alt=""
          className="h-14 w-14 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-[var(--color-surface-2)] text-[var(--color-muted)]">
          {progress.file?.type.startsWith("image/") ? (
            <ImageIcon className="h-6 w-6" />
          ) : (
            <FileText className="h-6 w-6" />
          )}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="truncate text-sm font-medium">
            {progress.file?.name ?? "Uploading…"}
          </div>
          {progress.error ? (
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          ) : progress.percent >= 100 ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--color-muted)]" />
          )}
        </div>
        {progress.error ? (
          <div className="mt-1 text-xs text-rose-600">{progress.error}</div>
        ) : (
          <>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-[var(--color-muted)]">
              <span>{progress.percent}%</span>
              {progress.file && <span>{fmtBytes(progress.file.size)}</span>}
            </div>
          </>
        )}
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        {progress.error ? (
          <button
            type="button"
            onClick={onRetry}
            aria-label="Retry"
            className="grid h-8 w-8 place-items-center rounded-lg text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-foreground)]"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
          className="grid h-8 w-8 place-items-center rounded-lg text-[var(--color-muted)] hover:bg-rose-500/10 hover:text-rose-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
