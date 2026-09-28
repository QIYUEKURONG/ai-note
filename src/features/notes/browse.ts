import type { NoteRow } from "@/db/schema";

export type NoteFilter = "all" | "favorites" | "recent";

export type NoteGroup = {
  id: string;
  label: string;
  notes: NoteRow[];
};

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function matchesQuery(note: NoteRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    note.title.toLowerCase().includes(q) ||
    note.contentText.toLowerCase().includes(q)
  );
}

export function filterNotes(
  notes: NoteRow[],
  options: { query?: string; filter?: NoteFilter; recentIds?: string[] },
): NoteRow[] {
  const filter = options.filter ?? "all";
  const query = options.query ?? "";
  const recentIds = options.recentIds ?? [];

  return notes.filter((note) => {
    if (!matchesQuery(note, query)) return false;
    if (filter === "favorites") return note.isFavorite;
    if (filter === "recent") return recentIds.includes(note.id);
    return true;
  });
}

export function groupNotesByTime(notes: NoteRow[], now = Date.now()): NoteGroup[] {
  const today = startOfDay(now);
  const yesterday = today - 24 * 60 * 60 * 1000;
  const week = today - 7 * 24 * 60 * 60 * 1000;

  const buckets: Record<string, NoteRow[]> = {
    today: [],
    yesterday: [],
    week: [],
    earlier: [],
  };

  for (const note of notes) {
    const day = startOfDay(note.updatedAt);
    if (day >= today) buckets.today.push(note);
    else if (day >= yesterday) buckets.yesterday.push(note);
    else if (day >= week) buckets.week.push(note);
    else buckets.earlier.push(note);
  }

  return [
    { id: "today", label: "今天", notes: buckets.today },
    { id: "yesterday", label: "昨天", notes: buckets.yesterday },
    { id: "week", label: "近 7 天", notes: buckets.week },
    { id: "earlier", label: "更早", notes: buckets.earlier },
  ].filter((group) => group.notes.length > 0);
}

export function formatNoteTime(ts: number, now = Date.now()): string {
  const day = startOfDay(ts);
  const today = startOfDay(now);
  if (day >= today) {
    return new Date(ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }
  if (day >= today - 24 * 60 * 60 * 1000) return "昨天";
  return new Date(ts).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

export function previewText(text: string, max = 72): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "还没有写下内容";
  return cleaned.length > max ? `${cleaned.slice(0, max)}…` : cleaned;
}

const RECENT_KEY = "mindbook.recentNoteIds";

export function readRecentNoteIds(limit = 12): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed) ? parsed.slice(0, limit) : [];
  } catch {
    return [];
  }
}

export function pushRecentNoteId(id: string, limit = 12): string[] {
  if (typeof window === "undefined") return [];
  const next = [id, ...readRecentNoteIds(limit).filter((item) => item !== id)].slice(0, limit);
  window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}
