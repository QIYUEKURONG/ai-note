import { describe, expect, it } from "vitest";
import {
  documentFromOrganizedMarkdown,
  documentToText,
  dropDeadImages,
  emptyDocument,
  extractHighlights,
  HIGHLIGHT_COLORS,
  parseDocument,
} from "@/lib/document";
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

  it("turns a pipe table into aligned rows", () => {
    const source = [
      "| 层 | 角色 | 可丢性 |",
      "|---|---|---|",
      '| MySQL | 权威裁决，"谁赞过"的唯一真相 | 不丢 |',
      "| Redis | 快路径，判重 + 计数 + 浏览 | 可丢可重建 |",
      "| Kafka | 高并发缓冲，持久可回放 | 不丢 |",
    ].join("\n");
    const doc = parseDocument(
      JSON.stringify({
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: source }] }],
      }),
    );
    const table = doc.content?.[0];
    expect(table?.type).toBe("table");
    expect(table?.content).toHaveLength(4);
    expect(table?.content?.[0]?.content?.map((cell) => cell.type)).toEqual([
      "tableHeader",
      "tableHeader",
      "tableHeader",
    ]);
    expect(table?.content?.[1]?.content?.[2]?.content?.[0]?.content?.[0]?.text).toBe("不丢");
    expect(table?.content?.[2]?.content?.[2]?.content?.[0]?.content?.[0]?.text).toBe("可丢可重建");
    expect(documentToText(doc)).toContain("可丢可重建");

    const organized = documentFromOrganizedMarkdown(`三、要点小结\n\n${source}\n\n• 判重靠 SADD`, "REDIS");
    expect(organized.content?.some((node) => node.type === "table")).toBe(true);
  });

  it("hashes content stably", () => {
    expect(hashContent("abc")).toBe(hashContent("abc"));
    expect(hashContent("abc")).not.toBe(hashContent("abd"));
  });
});
