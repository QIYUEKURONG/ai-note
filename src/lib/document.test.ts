import { describe, expect, it } from "vitest";
import {
  collectImages,
  documentFromOrganizedMarkdown,
  documentToText,
  dropDeadImages,
  emptyDocument,
  extractHighlights,
  HIGHLIGHT_COLORS,
  noteSourceForOrganize,
  parseDocument,
  replaceScopeWithMarkdown,
  type TipTapDoc,
  type TipTapNode,
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

  it("turns fences, highlights, and lists into real blocks", () => {
    const doc = documentFromOrganizedMarkdown(
      ["## 机制", "", "记住 ==ISR== 和 **副本**。", "", "```ts", "const n = 1", "```", "", "- 先写进日志", "- 再提交"].join(
        "\n",
      ),
      "Kafka",
    );
    const heading = doc.content?.find((node) => node.type === "heading" && node.attrs?.level === 3);
    expect(heading?.content?.some((node) => node.text === "机制")).toBe(true);
    const paragraph = doc.content?.find((node) => node.type === "paragraph");
    expect(paragraph?.content?.find((node) => node.text === "ISR")?.marks?.[0]).toEqual({
      type: "highlight",
      attrs: { color: HIGHLIGHT_COLORS.yellow },
    });
    expect(paragraph?.content?.find((node) => node.text === "副本")?.marks?.[0]?.type).toBe("bold");
    const code = doc.content?.find((node) => node.type === "codeBlock");
    expect(code?.attrs?.language).toBe("ts");
    expect(code?.content?.[0]?.text).toBe("const n = 1");
    expect(doc.content?.some((node) => node.type === "bulletList")).toBe(true);
    expect(documentToText(doc)).toContain("先写进日志");
  });

  it("keeps pictures when a note is rewritten", () => {
    const previous = {
      type: "doc" as const,
      content: [
        { type: "paragraph", content: [{ type: "text", text: "前面" }] },
        { type: "image", attrs: { src: "/api/media/a.png" } },
        { type: "image", attrs: { src: "blob:http://127.0.0.1:3000/tmp" } },
        { type: "paragraph", content: [{ type: "text", text: "后面" }] },
      ],
    };
    const source = noteSourceForOrganize(previous);
    expect(source.indexOf("[[图1]]")).toBeGreaterThan(source.indexOf("前面"));
    expect(source).not.toContain("[[图2]]");
    const kept = collectImages(previous);
    const placed = documentFromOrganizedMarkdown(`前面\n\n[[图1]]\n\n后面`, "标题", kept);
    expect(placed.content?.map((node) => node.type)).toEqual(["heading", "paragraph", "image", "paragraph"]);
    expect(placed.content?.[2]?.attrs?.src).toBe("/api/media/a.png");

    const appended = documentFromOrganizedMarkdown("只有文字", "标题", kept);
    expect(appended.content?.at(-1)).toMatchObject({ type: "image", attrs: { src: "/api/media/a.png" } });
  });

  function nodeText(node: TipTapNode): string {
  if (node.text) return node.text;
  return (node.content ?? []).map(nodeText).join("");
}

it("writes a selected markdown passage back as headings, lists, and code", () => {
  const source = [
    "# Agent 课程笔记：Chat Completions 与 Responses 对比",
    "",
    "## 1. 请求地址不同",
    "- Chat Completions：`POST /v1/chat/completions`",
    "- Responses：`POST /v1/responses`",
    "",
    "## 2. 请求体不同",
    "```json",
    '{ "model": "模型名" }',
    "```",
    "",
    "Responses 还可以使用 ==instructions== 单独传入指令。",
  ].join("\n");
  const doc: TipTapDoc = {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Agent 课程笔记" }] },
      { type: "paragraph", content: [{ type: "text", text: source }] },
      { type: "paragraph", content: [{ type: "text", text: "保留在后面" }] },
    ],
  };
  const next = replaceScopeWithMarkdown(doc, source, source);
  expect(next).not.toBeNull();
  expect(documentToText(doc)).toContain("```json");
  const types = next!.content?.map((node) => node.type);
  expect(types?.[0]).toBe("heading");
  expect(next!.content?.[0]?.content?.[0]?.text).toBe("Agent 课程笔记");
  expect(types).toContain("bulletList");
  expect(types).toContain("codeBlock");
  const code = next!.content?.find((node) => node.type === "codeBlock");
  expect(code?.attrs?.language).toBe("json");
  expect(code?.content?.[0]?.text).toBe('{ "model": "模型名" }');
  const rendered = next!.content?.map(nodeText).join("\n") ?? "";
  expect(rendered).not.toContain("```");
  expect(rendered).not.toContain("# ");
  expect(rendered).not.toContain("`POST");
  const item = next!.content
    ?.find((node) => node.type === "bulletList")
    ?.content?.[0]?.content?.[0]?.content?.find((node) => node.text?.includes("POST"));
  expect(item?.marks?.[0]?.type).toBe("code");
  const highlighted = next!.content
    ?.flatMap((node) => node.content ?? [])
    .find((node) => node.text === "instructions");
  expect(highlighted?.marks?.[0]).toEqual({ type: "highlight", attrs: { color: HIGHLIGHT_COLORS.yellow } });
  expect(next!.content?.at(-1)?.content?.[0]?.text).toBe("保留在后面");
});

it("replaces a selection that was split across paragraphs", () => {
  const doc: TipTapDoc = {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "标题" }] },
      { type: "paragraph", content: [{ type: "text", text: "# 第一节" }] },
      { type: "paragraph", content: [{ type: "text", text: "- 要点" }] },
      { type: "paragraph", content: [{ type: "text", text: "还在" }] },
    ],
  };
  const next = replaceScopeWithMarkdown(doc, "# 第一节- 要点", "## 第一节\n\n- 要点");
  expect(next!.content?.map((node) => node.type)).toEqual(["heading", "heading", "bulletList", "paragraph"]);
  expect(next!.content?.[1]?.content?.[0]?.text).toBe("第一节");
  expect(next!.content?.[3]?.content?.[0]?.text).toBe("还在");
});

it("keeps the unmatched sides of a paragraph", () => {
  const doc: TipTapDoc = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "前文 # 要改的 后文" }] },
    ],
  };
  const next = replaceScopeWithMarkdown(doc, "# 要改的", "## 要改的");
  expect(next!.content?.map((node) => node.type)).toEqual(["paragraph", "heading", "paragraph"]);
  expect(next!.content?.[0]?.content?.[0]?.text).toBe("前文 ");
  expect(next!.content?.[1]?.content?.[0]?.text).toBe("要改的");
  expect(next!.content?.[2]?.content?.[0]?.text).toBe(" 后文");
});

it("lifts markdown out of a code block and a list item", () => {
  const doc: TipTapDoc = {
    type: "doc",
    content: [
      {
        type: "codeBlock",
        attrs: { language: null },
        content: [{ type: "text", text: "# 从代码里出来\n- 一条" }],
      },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [{ type: "paragraph", content: [{ type: "text", text: "## 列表里的标题" }] }],
          },
        ],
      },
    ],
  };
  const fromCode = replaceScopeWithMarkdown(doc, "# 从代码里出来\n- 一条", "# 从代码里出来\n\n- 一条");
  expect(fromCode!.content?.some((node) => node.type === "codeBlock")).toBe(false);
  expect(fromCode!.content?.some((node) => node.type === "heading")).toBe(true);
  expect(fromCode!.content?.some((node) => node.type === "bulletList")).toBe(true);

  const fromList = replaceScopeWithMarkdown(doc, "## 列表里的标题", "## 列表里的标题");
  expect(fromList!.content?.some((node) => node.type === "bulletList" && nodeText(node).includes("列表里的标题"))).toBe(
    false,
  );
  expect(fromList!.content?.some((node) => node.type === "heading" && node.content?.[0]?.text === "列表里的标题")).toBe(
    true,
  );
});

it("returns null when the selected passage is not in the note", () => {
  const doc: TipTapDoc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "原文" }] }] };
  expect(replaceScopeWithMarkdown(doc, "不存在", "## 新的")).toBeNull();
});

it("hashes content stably", () => {
    expect(hashContent("abc")).toBe(hashContent("abc"));
    expect(hashContent("abc")).not.toBe(hashContent("abd"));
  });
});
