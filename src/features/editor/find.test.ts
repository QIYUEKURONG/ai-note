import { describe, expect, it } from "vitest";
import { findInText } from "./find";

describe("find in note text", () => {
  it("finds every case-insensitive hit and skips overlaps", () => {
    expect(findInText("Agent 与 agent，还有模型", "agent")).toEqual([
      { start: 0, end: 5 },
      { start: 8, end: 13 },
    ]);
  });

  it("returns nothing for a blank query", () => {
    expect(findInText("正文", "  ")).toEqual([]);
  });
});
