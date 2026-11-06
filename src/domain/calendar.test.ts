import { describe, expect, it } from "vitest";
import {
  formatShortDay,
  isDayKey,
  mergeSlipText,
  mergeTargetDay,
  monthGrid,
  noteTitleForSlips,
  normalizeSlipBody,
  shiftMonth,
} from "./calendar";

const slips = [
  { id: "a", day: "2026-11-06", body: "另一句", createdAt: 2 },
  { id: "b", day: "2026-11-03", body: "写完消费者组", createdAt: 1 },
  { id: "c", day: "2026-11-06", body: "ISR 是同步副本集合", createdAt: 3 },
];

describe("calendar", () => {
  it("rejects dates that are not real days", () => {
    expect(isDayKey("2026-11-06")).toBe(true);
    expect(isDayKey("2024-02-29")).toBe(true);
    expect(isDayKey("2026-02-29")).toBe(false);
    expect(isDayKey("2026-11-31")).toBe(false);
    expect(isDayKey("2026-11-6")).toBe(false);
  });

  it("builds a Monday-first month and drops an empty trailing week", () => {
    const november = monthGrid(2026, 11);
    expect(november[0]).toEqual({ day: "2026-10-26", inMonth: false });
    expect(november.find((cell) => cell.day === "2026-11-01")?.inMonth).toBe(true);
    expect(november.at(-1)).toEqual({ day: "2026-12-06", inMonth: false });
    expect(november).toHaveLength(42);

    const february = monthGrid(2026, 2);
    expect(february[0].day).toBe("2026-01-26");
    expect(february.at(-1)?.day).toBe("2026-03-01");
    expect(february).toHaveLength(35);
    expect(february.filter((cell) => cell.inMonth)).toHaveLength(28);
  });

  it("walks across year boundaries", () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
  });

  it("joins same-day lines and labels slips that span days", () => {
    expect(normalizeSlipBody("  一句  ")).toBe("一句");
    expect(
      mergeSlipText([
        { id: "a", day: "2026-11-06", body: "一句话", createdAt: 1 },
        { id: "b", day: "2026-11-06", body: "另一句", createdAt: 2 },
      ]),
    ).toBe("一句话\n另一句");
    expect(mergeSlipText(slips)).toBe("11月3日\n写完消费者组\n\n11月6日\n另一句\nISR 是同步副本集合");
    expect(mergeTargetDay(slips)).toBe("2026-11-06");
    expect(noteTitleForSlips(slips)).toBe("灵感 · 11月3日–11月6日");
    expect(formatShortDay("2025-12-31", true)).toBe("2025年12月31日");
  });
});
