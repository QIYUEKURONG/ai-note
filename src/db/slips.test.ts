import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "./client";
import { getNote } from "./repos";
import { collectSlips, createSlip, deleteSlip, listSlipsBetween, mergeSlips, updateSlip } from "./slips";

describe("calendar slips", () => {
  beforeEach(() => {
    process.env.MINDBOOK_DB = ":memory:";
    resetDbForTests();
  });

  afterEach(() => {
    resetDbForTests();
    delete process.env.MINDBOOK_DB;
  });

  it("stores a sentence on a day and hides it outside the range", () => {
    expect(createSlip({ day: "2026-02-31", body: "不行" })).toBeNull();
    expect(createSlip({ day: "2026-11-06", body: "   " })).toBeNull();
    const slip = createSlip({ day: "2026-11-06", body: "  一句话  ", color: "sky" });
    expect(slip?.body).toBe("一句话");
    expect(slip?.color).toBe("sky");
    expect(listSlipsBetween("2026-11-01", "2026-11-30")).toHaveLength(1);
    expect(listSlipsBetween("2026-10-01", "2026-10-31")).toHaveLength(0);
  });

  it("edits and deletes a slip", () => {
    const slip = createSlip({ day: "2026-11-06", body: "草稿" });
    expect(updateSlip(slip!.id, { body: "改过的一句", color: "mint" })?.body).toBe("改过的一句");
    expect(updateSlip(slip!.id, { body: "  " })).toBeNull();
    expect(deleteSlip(slip!.id)).toBe(true);
    expect(listSlipsBetween("2026-11-01", "2026-11-30")).toHaveLength(0);
  });

  it("merges slips onto the latest day and removes the sources", () => {
    const early = createSlip({ day: "2026-11-03", body: "写完消费者组", color: "butter" });
    const later = createSlip({ day: "2026-11-06", body: "ISR 是同步副本集合", color: "sky" });
    const merged = mergeSlips([later!.id, early!.id]);
    expect(merged?.day).toBe("2026-11-06");
    expect(merged?.color).toBe("butter");
    expect(merged?.body).toContain("11月3日");
    expect(merged?.body).toContain("写完消费者组");
    expect(listSlipsBetween("2026-11-01", "2026-11-30").map((slip) => slip.id)).toEqual([merged!.id]);
    expect(mergeSlips([merged!.id])).toBeNull();
  });

  it("collects slips into a note and leaves the calendar untouched", () => {
    const first = createSlip({ day: "2026-11-06", body: "一句话" });
    const second = createSlip({ day: "2026-11-06", body: "另一句" });
    const noteId = collectSlips([first!.id, second!.id]);
    const note = getNote(noteId!);
    expect(note?.title).toBe("灵感 · 11月6日");
    expect(note?.contentText).toContain("一句话");
    expect(note?.contentText).toContain("另一句");
    expect(listSlipsBetween("2026-11-01", "2026-11-30")).toHaveLength(2);
  });
});
