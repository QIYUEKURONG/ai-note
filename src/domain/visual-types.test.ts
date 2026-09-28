import { describe, expect, it } from "vitest";
import { routeVisualType } from "./visual-types";

describe("visual router", () => {
  it("routes architecture notes", () => {
    expect(routeVisualType("Kafka 消费者组 架构 组件")).toBe("architecture");
  });

  it("routes comparison notes", () => {
    expect(routeVisualType("ISR 和 AR 的区别 对比")).toBe("comparison");
  });

  it("falls back to illustration", () => {
    expect(routeVisualType("今天天气不错")).toBe("illustration");
  });
});
