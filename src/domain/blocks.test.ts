import { describe, expect, it } from "vitest";
import { calloutHeading, calloutKind, markerByGlyphPrefix, sectionListIndexes, type BlockRef } from "./blocks";

describe("blocks", () => {
  it("reads a marker glyph and a callout name", () => {
    expect(markerByGlyphPrefix("♥ 记下")).toEqual({ id: "heart", rest: "记下" });
    expect(markerByGlyphPrefix("🌲一棵")).toBeNull();
    expect(markerByGlyphPrefix("喜欢")).toBeNull();
    expect(calloutKind("灵感")).toBe("idea");
    expect(calloutKind("TIP")).toBe("tip");
    expect(calloutKind("unknown")).toBe("note");
    expect(calloutHeading("idea 二分之后")).toEqual({ kind: "idea", label: "二分之后" });
    expect(calloutHeading("灵感")).toEqual({ kind: "idea", label: null });
  });

  it("keeps a child heading's lists with that child", () => {
    const blocks: BlockRef[] = [
      { type: "heading", level: 2 },
      { type: "bulletList" },
      { type: "paragraph" },
      { type: "bulletList" },
      { type: "heading", level: 3 },
      { type: "bulletList" },
      { type: "heading", level: 3 },
      { type: "bulletList" },
      { type: "heading", level: 2 },
      { type: "bulletList" },
    ];
    expect(sectionListIndexes(blocks, 0)).toEqual([1, 3]);
    expect(sectionListIndexes(blocks, 4)).toEqual([5]);
    expect(sectionListIndexes(blocks, 6)).toEqual([7]);
    expect(sectionListIndexes(blocks, 8)).toEqual([9]);
    expect(sectionListIndexes(blocks, 2)).toEqual([]);
  });
});
