import { describe, expect, it } from "vitest";
import { normalizeReviewDrafts, parseStoredReview } from "./review";

describe("review marks", () => {
  it("keeps valid drafts and drops duplicates", () => {
    const drafts = normalizeReviewDrafts({
      marks: [
        { quote: "消费者组会重复消费", kind: "error", explanation: "这里说反了", suggestion: "消费者组内分区不会被重复消费" },
        { quote: "消费者组会重复消费", kind: "error", explanation: "重复", suggestion: "另一句" },
        { quote: "太短", kind: "nope", explanation: "无效", suggestion: "" },
        { quote: "提交位移", kind: "incomplete", explanation: "没说何时提交", suggestion: "处理完成后再提交位移" },
      ],
    });
    expect(drafts).toHaveLength(2);
    expect(drafts[0]?.kind).toBe("error");
    expect(drafts[1]?.kind).toBe("incomplete");
  });

  it("reads stored marks", () => {
    const marks = parseStoredReview(
      JSON.stringify({
        marks: [
          {
            id: "a",
            quote: "原文句子",
            kind: "deepen",
            explanation: "可以再展开",
            suggestion: "补充一个例子",
            status: "open",
          },
        ],
      }),
    );
    expect(marks[0]?.status).toBe("open");
  });
});
