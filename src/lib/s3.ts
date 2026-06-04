// S3 / MinIO file-upload helper. Issues presigned PUT URLs the client
// uploads directly to (no bytes through our app servers) and builds
// canonical public URLs to persist in the DB.

import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "crypto";

const endpoint = process.env.S3_ENDPOINT ?? "";
const region = process.env.S3_REGION ?? "us-east-1";
const bucket = process.env.S3_BUCKET ?? "";
const accessKeyId = process.env.S3_ACCESS_KEY ?? "";
const secretAccessKey = process.env.S3_SECRET_KEY ?? "";
const forcePathStyle =
  (process.env.S3_FORCE_PATH_STYLE ?? "true").toLowerCase() === "true";
const publicBase = (process.env.S3_PUBLIC_URL ?? "").replace(/\/$/, "");

let _client: S3Client | null = null;
export function s3() {
  if (!_client) {
    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
      throw new Error(
        "S3 not configured — set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY.",
      );
    }
    _client = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle,
    });
  }
  return _client;
}

export function s3Bucket() {
  return bucket;
}

// Strip anything that could break URLs or be exploited as a path.
function sanitizeFileName(name: string): string {
  const cleaned = (name || "file")
    .replace(/[\\/]/g, "_")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return cleaned.slice(0, 120) || "file";
}

// Build a deterministic-prefix key with a random suffix so two uploads
// of the same filename never collide.
export function buildS3Key(opts: {
  scope: string; // "properties" | "expense-receipts" | "service-charge" | ...
  scopeId?: string; // e.g. propertyId
  fileName: string;
}): string {
  const safe = sanitizeFileName(opts.fileName);
  const rand = randomBytes(8).toString("hex");
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const scope = opts.scope.replace(/[^a-z0-9-]/gi, "_");
  const idPart = opts.scopeId ? `/${opts.scopeId}` : "";
  return `${scope}${idPart}/${yyyy}/${mm}/${rand}-${safe}`;
}

// Translate an S3 key into the public URL admins/owners will see.
export function publicUrlFor(key: string): string {
  if (publicBase) return `${publicBase}/${key}`;
  // Fallback: endpoint + bucket + key (path-style).
  return `${endpoint.replace(/\/$/, "")}/${bucket}/${key}`;
}

// Issue a short-lived PUT URL the browser hits directly.
export async function createPresignedPut(opts: {
  key: string;
  contentType?: string;
  expiresSec?: number;
}) {
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: opts.key,
    ContentType: opts.contentType,
  });
  const uploadUrl = await getSignedUrl(s3(), cmd, {
    expiresIn: opts.expiresSec ?? 60 * 10, // 10 min default
  });
  return { uploadUrl, publicUrl: publicUrlFor(opts.key) };
}

export async function deleteS3Object(key: string) {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

// Pull the bucket key out of a stored public URL — used when we delete a
// PropertyMedia row and want to clean up the S3 object too.
export function keyFromPublicUrl(url: string): string | null {
  if (!url) return null;
  const base = publicBase || `${endpoint.replace(/\/$/, "")}/${bucket}`;
  if (!url.startsWith(base + "/")) return null;
  return url.slice(base.length + 1);
}
