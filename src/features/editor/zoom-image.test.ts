import { describe, expect, it } from "vitest";
import { MAX_IMAGE_WIDTH, MIN_IMAGE_WIDTH, nextImageWidth } from "./zoom-image";

describe("image zoom width", () => {
  it("grows and shrinks inside the limits", () => {
    expect(nextImageWidth(200, "in")).toBe(250);
    expect(nextImageWidth(200, "out")).toBe(160);
    expect(nextImageWidth(MIN_IMAGE_WIDTH, "out")).toBe(MIN_IMAGE_WIDTH);
    expect(nextImageWidth(MAX_IMAGE_WIDTH, "in")).toBe(MAX_IMAGE_WIDTH);
  });
});
