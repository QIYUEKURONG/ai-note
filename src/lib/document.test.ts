import { describe, expect, it } from "vitest";
import { dropDeadImages, emptyDocument, documentToText, extractHighlights, HIGHLIGHT_COLORS } from "@/lib/document";
import { hashContent } from "@/lib/id";

describe("document", () => {
  it("extracts text from headings and paragraphs", () => {
    const doc = emptyDocument("Kafka 消费者组");
    expect(documentToText(doc)).toContain("Kafka 消费者组");
  });

  it("extracts highlight marks", () => {
    const highlights = extractHighlights({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "ISR",
              marks: [{ type: "highlight", attrs: { color: HIGHLIGHT_COLORS.yellow } }],
            },
          ],
        },
      ],
    });
    expect(highlights).toEqual([{ text: "ISR", color: HIGHLIGHT_COLORS.yellow }]);
  });

  it("drops temporary blob images and keeps stored ones", () => {
    const doc = dropDeadImages({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "MYSQL" }] },
        { type: "image", attrs: { src: "blob:http://127.0.0.1:3000/abc" } },
        { type: "image", attrs: { src: "/api/media/kept.png" } },
      ],
    });
    expect(doc.content?.map((node) => node.type)).toEqual(["heading", "image"]);
    expect(doc.content?.[1]?.attrs?.src).toBe("/api/media/kept.png");
  });

  it("hashes content stably", () => {
    expect(hashContent("abc")).toBe(hashContent("abc"));
    expect(hashContent("abc")).not.toBe(hashContent("abd"));
  });
});
