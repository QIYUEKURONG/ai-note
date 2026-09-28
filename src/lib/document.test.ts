import { describe, expect, it } from "vitest";
import { emptyDocument, documentToText, extractHighlights, HIGHLIGHT_COLORS } from "@/lib/document";
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

  it("hashes content stably", () => {
    expect(hashContent("abc")).toBe(hashContent("abc"));
    expect(hashContent("abc")).not.toBe(hashContent("abd"));
  });
});
