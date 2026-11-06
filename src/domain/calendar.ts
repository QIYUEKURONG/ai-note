export const SLIP_COLORS = ["cream", "butter", "mint", "sky", "blush"] as const;
export type SlipColor = (typeof SLIP_COLORS)[number];

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_BODY = 2000;

export type SlipLike = {
  id: string;
  day: string;
  body: string;
  createdAt: number;
};

export type CalendarCell = {
  day: string;
  inMonth: boolean;
};

export function isSlipColor(value: string): value is SlipColor {
  return (SLIP_COLORS as readonly string[]).includes(value);
}

export function isDayKey(value: string): boolean {
  const match = DAY.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function todayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** Monday-first weeks. A trailing week that sits entirely in the next month is dropped. */
export function monthGrid(year: number, month: number): CalendarCell[] {
  const first = new Date(year, month - 1, 1);
  const lead = (first.getDay() + 6) % 7;
  const start = new Date(year, month - 1, 1 - lead);
  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({
      day: todayKey(date),
      inMonth: date.getFullYear() === year && date.getMonth() === month - 1,
    });
  }
  if (cells.slice(35).every((cell) => !cell.inMonth)) return cells.slice(0, 35);
  return cells;
}

export function dayNumber(day: string): number {
  return Number(day.slice(8, 10));
}

export function formatMonthTitle(year: number, month: number): string {
  return `${year}年${month}月`;
}

export function formatDayTitle(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return `${year}年${month}月${date}日`;
}

export function formatShortDay(day: string, withYear = false): string {
  const [year, month, date] = day.split("-").map(Number);
  return withYear ? `${year}年${month}月${date}日` : `${month}月${date}日`;
}

export function normalizeSlipBody(body: string): string {
  return body.replace(/\r\n/g, "\n").trim().slice(0, MAX_BODY);
}

export function orderSlips<T extends SlipLike>(slips: T[]): T[] {
  return [...slips].sort((a, b) => a.day.localeCompare(b.day) || a.createdAt - b.createdAt);
}

export function mergeSlipText(slips: SlipLike[]): string {
  const ordered = orderSlips(slips).filter((slip) => slip.body.trim());
  if (ordered.length === 0) return "";
  const days = new Set(ordered.map((slip) => slip.day));
  if (days.size === 1) return ordered.map((slip) => slip.body.trim()).join("\n");
  const withYear = new Set(ordered.map((slip) => slip.day.slice(0, 4))).size > 1;
  const groups = new Map<string, string[]>();
  for (const slip of ordered) {
    const lines = groups.get(slip.day) ?? [];
    lines.push(slip.body.trim());
    groups.set(slip.day, lines);
  }
  return [...groups.entries()]
    .map(([day, lines]) => `${formatShortDay(day, withYear)}\n${lines.join("\n")}`)
    .join("\n\n");
}

export function mergeTargetDay(slips: SlipLike[]): string {
  const ordered = orderSlips(slips);
  return ordered[ordered.length - 1]?.day ?? todayKey();
}

export function noteTitleForSlips(slips: SlipLike[]): string {
  const ordered = orderSlips(slips);
  if (ordered.length === 0) return "灵感";
  const withYear = ordered[0].day.slice(0, 4) !== ordered[ordered.length - 1].day.slice(0, 4);
  const first = formatShortDay(ordered[0].day, withYear);
  const last = formatShortDay(ordered[ordered.length - 1].day, withYear);
  return first === last ? `灵感 · ${first}` : `灵感 · ${first}–${last}`;
}
