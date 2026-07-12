import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DomainError } from "@/lib/errors";

const allowed = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/plain",
]);
const maxBytes = 10 * 1024 * 1024;
export function validateUpload(file: File) {
  if (!allowed.has(file.type))
    throw new DomainError(
      "INVALID_FILE_TYPE",
      "Only JPEG, PNG, WebP, PDF, and plain text files are allowed.",
    );
  if (file.size <= 0 || file.size > maxBytes)
    throw new DomainError(
      "INVALID_FILE_SIZE",
      "Files must be between 1 byte and 10 MB.",
    );
}
function safeExtension(file: File) {
  const known: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
    "text/plain": ".txt",
  };
  return known[file.type];
}
export async function store(file: File) {
  validateUpload(file);
  const key = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}${safeExtension(file)}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  if ((process.env.UPLOAD_DRIVER ?? "local") === "s3") {
    const bucket = process.env.S3_BUCKET;
    if (!bucket)
      throw new DomainError(
        "STORAGE_NOT_CONFIGURED",
        "S3_BUCKET is required for the S3 upload driver.",
      );
    const client = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION ?? "auto",
      forcePathStyle: Boolean(process.env.S3_ENDPOINT),
      credentials:
        process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.S3_ACCESS_KEY_ID,
              secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
            }
          : undefined,
    });
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: bytes,
        ContentType: file.type,
      }),
    );
  } else {
    const root = path.normalize(process.env.UPLOAD_DIR ?? "storage/uploads");
    const target = path.join(root, key);
    const relative = path.relative(root, target);
    if (relative.startsWith("..") || path.isAbsolute(relative))
      throw new DomainError("INVALID_STORAGE_PATH", "Unsafe storage path.");
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes, { flag: "wx" });
  }
  return {
    key,
    name: path.basename(file.name),
    mimeType: file.type,
    size: file.size,
  };
}
