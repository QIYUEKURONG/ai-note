import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "./client";
import { acceptMergeDraft, applyAtlas, confirmPoint, getSpace, saveMergeDraft } from "./knowledge";
import { createNote, getNote, updateNote } from "./repos";

function write(id: string, text: string) {
  updateNote(id, {
    contentJson: JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    }),
  });
}

describe("knowledge repo", () => {
  beforeEach(() => {
    process.env.MINDBOOK_DB = ":memory:";
    resetDbForTests();
  });

  afterEach(() => {
    resetDbForTests();
    delete process.env.MINDBOOK_DB;
  });

  it("keeps confirmed points when the map is rebuilt", () => {
    const note = createNote("Kafka");
    applyAtlas(
      {
        points: [{ label: "位移提交", summary: "处理完再提交", noteTitles: ["Kafka"] }],
        edges: [],
      },
      [{ id: note.id, title: note.title }],
    );
    const first = getSpace().points[0];
    expect(first?.status).toBe("suggested");
    expect(confirmPoint(first.id)).toBe(true);
    applyAtlas(
      {
        points: [{ label: "再均衡", summary: "重新分配分区", noteTitles: ["Kafka"] }],
        edges: [],
      },
      [{ id: note.id, title: note.title }],
    );
    const labels = getSpace().points.map((point) => point.label);
    expect(labels).toHaveLength(2);
    expect(labels).toContain("再均衡");
    expect(labels).toContain("位移提交");
    expect(getSpace().points.find((point) => point.label === "位移提交")?.status).toBe("confirmed");
  });

  it("creates a new note from a merge draft and leaves the sources untouched", () => {
    const left = createNote("甲");
    const right = createNote("乙");
    write(left.id, "甲说立刻提交");
    write(right.id, "乙说批量提交");
    const before = [getNote(left.id)?.contentHash, getNote(right.id)?.contentHash];
    const draftId = saveMergeDraft([left.id, right.id], {
      title: "提交时机",
      body: "两边对提交时机的说法不同。",
      duplicates: [],
      conflicts: [{ topic: "时机", detail: "立刻或批量" }],
    });
    const created = acceptMergeDraft(draftId);
    expect(created?.noteId).toBeTruthy();
    expect(created?.noteId).not.toBe(left.id);
    expect(getNote(left.id)?.contentHash).toBe(before[0]);
    expect(getNote(right.id)?.contentHash).toBe(before[1]);
    expect(getNote(created!.noteId)?.contentText).toContain("提交时机");
    expect(getSpace().drafts).toHaveLength(0);
  });
});
