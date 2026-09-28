import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "./client";
import { createNote, getNote, listNotes, softDeleteNote, updateNote } from "./repos";

describe("notes repo", () => {
  beforeEach(() => {
    process.env.MINDBOOK_DB = ":memory:";
    resetDbForTests();
  });

  afterEach(() => {
    resetDbForTests();
    delete process.env.MINDBOOK_DB;
  });

  it("creates lists and does not let soft-deleted notes reappear", () => {
    const note = createNote("Kafka 消费者组");
    expect(note.title).toBe("Kafka 消费者组");
    expect(listNotes()).toHaveLength(1);
    expect(softDeleteNote(note.id)).toBe(true);
    expect(listNotes()).toHaveLength(0);
    expect(getNote(note.id)).toBeNull();
  });

  it("updates document text and hash together", () => {
    const note = createNote("草稿");
    const updated = updateNote(note.id, {
      contentJson: JSON.stringify({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "ISR 是同步副本集合" }],
          },
        ],
      }),
    });
    expect(updated?.contentText).toContain("ISR");
    expect(updated?.contentHash).not.toBe(note.contentHash);
  });
});
