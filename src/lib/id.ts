import { createHash } from "node:crypto";

export function hashContent(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function createId(): string {
  return crypto.randomUUID();
}

export function now(): number {
  return Date.now();
}
