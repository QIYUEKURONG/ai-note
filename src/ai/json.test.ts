import { describe, expect, it } from "vitest";
import { parseJsonFromModel, splitSpeculation } from "./json";

describe("model json", () => {
  it("parses fenced json", () => {
    const value = parseJsonFromModel<{ a: number }>("```json\n{\"a\":1}\n```");
    expect(value.a).toBe(1);
  });

  it("keeps AI speculation markers", () => {
    const result = splitSpeculation("事实。\n[AI推测]副本可能被踢出 ISR。");
    expect(result.spans[0]?.text).toContain("副本可能被踢出 ISR");
    expect(result.body).toContain("[AI推测]");
  });
});
