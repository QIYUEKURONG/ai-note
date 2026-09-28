import { describe, expect, it } from "vitest";
import { layoutKnowledge, masteryFromScore, normalizeAtlas, normalizeMerge } from "./knowledge";

describe("knowledge drafts", () => {
  it("keeps concrete points and drops unknown relations into 相关", () => {
    const atlas = normalizeAtlas({
      points: [
        { label: "位移提交", summary: "处理完再提交", noteTitles: ["Kafka"] },
        { label: "再均衡", summary: "重新分配", noteTitles: [] },
        { label: "位移提交", summary: "重复" },
        { label: "  ", summary: "空" },
      ],
      edges: [
        { from: "位移提交", to: "位移提交", relation: "depends", reason: "自己" },
        { from: "位移提交", to: "不存在", relation: "contains", reason: "无" },
        { from: "位移提交", to: "再均衡", relation: "mystery", reason: "相关" },
      ],
    });
    expect(atlas.points).toHaveLength(2);
    expect(atlas.edges).toEqual([
      expect.objectContaining({ from: "位移提交", to: "再均衡", relation: "related" }),
    ]);
  });

  it("accepts an edge only when both points exist", () => {
    const atlas = normalizeAtlas({
      points: [
        { label: "消费者组", summary: "一组消费者", noteTitles: [] },
        { label: "再均衡", summary: "重新分配分区", noteTitles: [] },
      ],
      edges: [{ from: "再均衡", to: "消费者组", relation: "depends", reason: "组变了才再均衡" }],
    });
    expect(atlas.edges[0]?.relation).toBe("depends");
  });

  it("maps scores onto mastery and keeps merge conflicts", () => {
    expect(masteryFromScore(90)).toBe("mastered");
    expect(masteryFromScore(70)).toBe("shaky");
    expect(masteryFromScore(10)).toBe("learning");
    const draft = normalizeMerge({
      title: "合并",
      body: "正文",
      duplicates: ["位移"],
      conflicts: [{ topic: "提交时机", detail: "一篇说立刻，一篇说批量" }],
    });
    expect(draft.conflicts).toHaveLength(1);
  });

  it("places two notes apart inside the map", () => {
    const nodes = layoutKnowledge({
      notes: [
        { id: "a", title: "甲" },
        { id: "b", title: "乙" },
      ],
      points: [{ id: "p", label: "概念", noteIds: ["a"], status: "suggested", mastery: "unknown" }],
    });
    const noteA = nodes.find((node) => node.refId === "a");
    const noteB = nodes.find((node) => node.refId === "b");
    const point = nodes.find((node) => node.refId === "p");
    expect(noteA && noteB && point).toBeTruthy();
    expect(Math.hypot((noteA?.x ?? 0) - (noteB?.x ?? 0), (noteA?.y ?? 0) - (noteB?.y ?? 0))).toBeGreaterThan(40);
    expect(point?.x).toBeGreaterThan(0);
    expect(point?.y).toBeGreaterThan(0);
  });
});
