import { describe, expect, it } from "vitest";
import { documentToText, type TipTapDoc } from "@/lib/document";
import { replaceQuote } from "./review-doc";

describe("replaceQuote", () => {
  it("replaces a sentence inside one text node", () => {
    const doc: TipTapDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "位移提交发生在处理之前。" }],
        },
      ],
    };
    const next = replaceQuote(doc, "位移提交发生在处理之前。", "处理完成后再提交位移。");
    expect(next).not.toBeNull();
    expect(documentToText(next!)).toContain("处理完成后再提交位移。");
    expect(documentToText(doc)).toContain("位移提交发生在处理之前。");
  });

  it("replaces a quote that spans two text nodes", () => {
    const doc: TipTapDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "消费者" },
            { type: "text", text: "组会重复消费" },
          ],
        },
      ],
    };
    const next = replaceQuote(doc, "消费者组会重复消费", "同组内一个分区只会被一个消费者读取");
    expect(documentToText(next!)).toBe("同组内一个分区只会被一个消费者读取");
  });

  it("returns null when the quote is missing", () => {
    const doc: TipTapDoc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "原文" }] }] };
    expect(replaceQuote(doc, "不存在的句子", "新句子")).toBeNull();
  });
});
