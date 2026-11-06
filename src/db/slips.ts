import { and, asc, eq, gte, lte } from "drizzle-orm";
import { isDayKey, isSlipColor, mergeSlipText, mergeTargetDay, normalizeSlipBody, noteTitleForSlips, orderSlips } from "@/domain/calendar";
import { createId, now } from "@/lib/id";
import { getDb, getSqliteRaw } from "./client";
import { createNote, getNote, updateNote } from "./repos";
import { calendarSlips, type CalendarSlipRow } from "./schema";

function slipDocument(title: string, body: string) {
  const paragraphs = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({
      type: "paragraph",
      content: [{ type: "text", text: line }],
    }));
  return {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: title }],
      },
      ...paragraphs,
    ],
  };
}

function loadSlips(ids: string[]): CalendarSlipRow[] | null {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return null;
  const db = getDb();
  const rows = unique
    .map((id) => db.select().from(calendarSlips).where(eq(calendarSlips.id, id)).get())
    .filter((row): row is CalendarSlipRow => Boolean(row));
  if (rows.length !== unique.length) return null;
  return rows;
}

export function listSlipsBetween(from: string, to: string): CalendarSlipRow[] {
  return getDb()
    .select()
    .from(calendarSlips)
    .where(and(gte(calendarSlips.day, from), lte(calendarSlips.day, to)))
    .orderBy(asc(calendarSlips.day), asc(calendarSlips.createdAt))
    .all();
}

export function getSlip(id: string): CalendarSlipRow | null {
  return getDb().select().from(calendarSlips).where(eq(calendarSlips.id, id)).get() ?? null;
}

export function createSlip(input: { day: string; body: string; color?: string }): CalendarSlipRow | null {
  if (!isDayKey(input.day)) return null;
  const body = normalizeSlipBody(input.body);
  if (!body) return null;
  const color = input.color && isSlipColor(input.color) ? input.color : "cream";
  const createdAt = now();
  const row: CalendarSlipRow = {
    id: createId(),
    day: input.day,
    body,
    color,
    createdAt,
    updatedAt: createdAt,
  };
  getDb().insert(calendarSlips).values(row).run();
  return row;
}

export function updateSlip(
  id: string,
  patch: { body?: string; color?: string; day?: string },
): CalendarSlipRow | null {
  const existing = getSlip(id);
  if (!existing) return null;
  const next: Partial<CalendarSlipRow> = { updatedAt: now() };
  if (patch.body !== undefined) {
    const body = normalizeSlipBody(patch.body);
    if (!body) return null;
    next.body = body;
  }
  if (patch.color !== undefined) {
    if (!isSlipColor(patch.color)) return null;
    next.color = patch.color;
  }
  if (patch.day !== undefined) {
    if (!isDayKey(patch.day)) return null;
    next.day = patch.day;
  }
  getDb().update(calendarSlips).set(next).where(eq(calendarSlips.id, id)).run();
  return getSlip(id);
}

export function deleteSlip(id: string): boolean {
  if (!getSlip(id)) return false;
  getDb().delete(calendarSlips).where(eq(calendarSlips.id, id)).run();
  return true;
}

export function mergeSlips(ids: string[]): CalendarSlipRow | null {
  const rows = loadSlips(ids);
  if (!rows || rows.length < 2) return null;
  const ordered = orderSlips(rows);
  const body = mergeSlipText(ordered);
  if (!body) return null;
  const createdAt = now();
  const slip: CalendarSlipRow = {
    id: createId(),
    day: mergeTargetDay(ordered),
    body,
    color: isSlipColor(ordered[0].color) ? ordered[0].color : "cream",
    createdAt,
    updatedAt: createdAt,
  };
  const db = getDb();
  getSqliteRaw().transaction(() => {
    db.insert(calendarSlips).values(slip).run();
    for (const row of rows) {
      db.delete(calendarSlips).where(eq(calendarSlips.id, row.id)).run();
    }
  })();
  return slip;
}

export function collectSlips(ids: string[]): string | null {
  const rows = loadSlips(ids);
  if (!rows) return null;
  const title = noteTitleForSlips(rows);
  const body = mergeSlipText(rows);
  if (!body) return null;
  const note = createNote(title);
  const updated = updateNote(note.id, { contentJson: JSON.stringify(slipDocument(title, body)) });
  return updated ? getNote(note.id)?.id ?? null : null;
}
