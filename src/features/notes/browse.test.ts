import { describe, expect, it } from "vitest";
import { filterNotes, groupNotesByTime, matchSnippet, matchesQuery, orderNotesByRecent } from "./browse";
import type { NoteRow } from "@/db/schema";

function note(partial: Partial<NoteRow> & Pick<NoteRow, "id" | "title">): NoteRow {
  return {
    contentJson: "{}",
    contentText: "",
    contentHash: "x",
    isFavorite: false,
    createdAt: 0,
    updatedAt: Date.now(),
    deletedAt: null,
    ...partial,
  };
}

describe("browse notes", () => {
  it("matches title and body", () => {
    const item = note({ id: "1", title: "Kafka", contentText: "ISR 集合" });
    expect(matchesQuery(item, "isr")).toBe(true);
    expect(matchesQuery(item, "zoo")).toBe(false);
  });

  it("shows the sentence around a body hit", () => {
    const snippet = matchSnippet("前面有很长的铺垫。这里写着 ISR 集合，后面还继续。", "isr");
    expect(snippet?.match.toLowerCase()).toBe("isr");
    expect(snippet?.before.endsWith("写着 ")).toBe(true);
    expect(snippet?.after.startsWith(" 集合")).toBe(true);
    expect(matchSnippet("没有这个词", "zoo")).toBeNull();
  });

  it("filters favorites and groups by day", () => {
    const now = Date.parse("2026-09-20T12:00:00+08:00");
    const notes = [
      note({ id: "a", title: "A", isFavorite: true, updatedAt: now }),
      note({ id: "b", title: "B", updatedAt: now - 2 * 24 * 60 * 60 * 1000 }),
    ];
    expect(filterNotes(notes, { filter: "favorites" }).map((n) => n.id)).toEqual(["a"]);
    const groups = groupNotesByTime(notes, now);
    expect(groups[0]?.id).toBe("today");
    expect(groups.some((g) => g.id === "week")).toBe(true);
  });

  it("moves a recently opened note to the front", () => {
    const notes = [
      note({ id: "old", title: "旧", updatedAt: 300 }),
      note({ id: "mid", title: "中", updatedAt: 200 }),
      note({ id: "new", title: "新", updatedAt: 100 }),
    ];
    expect(orderNotesByRecent(notes, ["new", "old"]).map((item) => item.id)).toEqual([
      "new",
      "old",
      "mid",
    ]);
  });
});
