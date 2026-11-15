import { describe, expect, it } from "vitest";
import { exportFilename, noteToHtml, noteToMarkdown, noteToPlainText } from "./export-note";
import type { TipTapDoc } from "@/lib/document";

const doc: TipTapDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "分区", marks: [{ type: "bold" }] }, { type: "text", text: "只会被一个消费者读取" }],
    },
    { type: "image", attrs: { src: "/api/media/a.png" } },
  ],
};

describe("export note", () => {
  it("builds a safe filename", () => {
    expect(exportFilename("KAFKA/笔记?", "md")).toBe("KAFKA 笔记.md");
    expect(exportFilename("   ", "pdf")).toBe("笔记.pdf");
  });

  it("keeps emphasis, images, and the title", () => {
    const markdown = noteToMarkdown("KAFKA", doc, ["/api/media/hung.jpg"]);
    expect(markdown).toContain("# KAFKA");
    expect(markdown).toContain("**分区**只会被一个消费者读取");
    expect(markdown).toContain("![](/api/media/a.png)");
    expect(markdown).toContain("![](/api/media/hung.jpg)");

    const html = noteToHtml("KAFKA", doc);
    expect(html).toContain("<h1>KAFKA</h1>");
    expect(html).toContain("<strong>分区</strong>");
    expect(html).toContain('src="/api/media/a.png"');

    expect(noteToPlainText("KAFKA", doc)).toContain("分区只会被一个消费者读取");
  });

  it("exports a table with aligned columns", () => {
    const table: TipTapDoc = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "层" }] }] },
                { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "可丢性" }] }] },
              ],
            },
            {
              type: "tableRow",
              content: [
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "MySQL" }] }] },
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "不丢" }] }] },
              ],
            },
          ],
        },
      ],
    };
    expect(noteToMarkdown("小结", table)).toContain("| 层 | 可丢性 |\n| --- | --- |\n| MySQL | 不丢 |");
    expect(noteToHtml("小结", table)).toContain("<th>层</th><th>可丢性</th>");
    expect(noteToHtml("小结", table)).toContain("<td>MySQL</td><td>不丢</td>");
  });

  it("exports callout boxes and parallel markers", () => {
    const fancy: TipTapDoc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2, parallel: "tree" }, content: [{ type: "text", text: "生长" }] },
        {
          type: "bulletList",
          attrs: { marker: "heart" },
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "喜欢" }] }] },
          ],
        },
        {
          type: "callout",
          attrs: { kind: "tip", label: "先看左边" },
          content: [{ type: "paragraph", content: [{ type: "text", text: "先写下来" }] }],
        },
      ],
    };
    const markdown = noteToMarkdown("标题", fancy);
    expect(markdown).toContain("## 🌲 生长");
    expect(markdown).toContain("♥ 喜欢");
    expect(markdown).toContain(":::tip 先看左边\n先写下来\n:::");
    const html = noteToHtml("标题", fancy);
    expect(html).toContain('data-parallel="tree"');
    expect(html).toContain('data-marker="heart"');
    expect(html).toContain('data-callout="tip"');
    expect(html).toContain("先看左边");
  });
});
