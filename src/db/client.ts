import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { ensureSchema } from "./ensure";

declare global {
  var __mindbookSqlite: Database.Database | undefined;
  var __mindbookDb: ReturnType<typeof drizzle<typeof schema>> | undefined;
}

function resolveDbPath(): string {
  if (process.env.MINDBOOK_DB) return process.env.MINDBOOK_DB;
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "mindbook.db");
}

function getSqlite(): Database.Database {
  if (globalThis.__mindbookSqlite) return globalThis.__mindbookSqlite;
  const file = resolveDbPath();
  const sqlite = file === ":memory:" ? new Database(":memory:") : new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  ensureSchema(sqlite);
  globalThis.__mindbookSqlite = sqlite;
  return sqlite;
}

export function getDb() {
  if (!globalThis.__mindbookDb) {
    globalThis.__mindbookDb = drizzle(getSqlite(), { schema });
  }
  return globalThis.__mindbookDb;
}

export function getSqliteRaw(): Database.Database {
  return getSqlite();
}

export function resetDbForTests() {
  globalThis.__mindbookSqlite?.close();
  globalThis.__mindbookSqlite = undefined;
  globalThis.__mindbookDb = undefined;
}
