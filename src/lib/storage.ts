import fs from "node:fs";
import path from "node:path";
import { createId } from "@/lib/id";

export function imagesDir(): string {
  const dir = path.join(process.cwd(), "storage", "images");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function saveImageFile(bytes: Buffer, mimeType: string): string {
  const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
  const filename = `${createId()}.${ext}`;
  const absolute = path.join(imagesDir(), filename);
  fs.writeFileSync(absolute, bytes);
  return `storage/images/${filename}`;
}

export function resolveStoredFile(relative: string): string | null {
  if (!relative.startsWith("storage/images/")) return null;
  const absolute = path.join(process.cwd(), relative);
  if (!absolute.startsWith(path.join(process.cwd(), "storage", "images"))) return null;
  if (!fs.existsSync(absolute)) return null;
  return absolute;
}

export function mimeFromPath(filePath: string): string {
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}
