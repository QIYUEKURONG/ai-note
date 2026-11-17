import { describe, expect, it } from "vitest";
import {
  MAX_IMAGE_WIDTH,
  MIN_IMAGE_WIDTH,
  fittedImageSize,
  inlineGrowthVisible,
  nextImageWidth,
} from "./zoom-image";

describe("image zoom width", () => {
  it("grows and shrinks inside the limits", () => {
    expect(nextImageWidth(200, "in")).toBe(250);
    expect(nextImageWidth(200, "out")).toBe(160);
    expect(nextImageWidth(MIN_IMAGE_WIDTH, "out")).toBe(MIN_IMAGE_WIDTH);
    expect(nextImageWidth(MAX_IMAGE_WIDTH, "in")).toBe(MAX_IMAGE_WIDTH);
  });

  it("stops growing inside the paper once the image already fills the column", () => {
    expect(inlineGrowthVisible(200, 640)).toBe(true);
    expect(inlineGrowthVisible(636, 640)).toBe(false);
    expect(inlineGrowthVisible(960, 640)).toBe(false);
  });

  it("fits the preview to the viewport instead of the paper column", () => {
    expect(fittedImageSize(1600, 900, 1200, 800)).toEqual({ width: 1200, height: 675 });
    expect(fittedImageSize(400, 200, 1200, 800)).toEqual({ width: 1200, height: 600 });
    expect(fittedImageSize(800, 1600, 1000, 700)).toEqual({ width: 350, height: 700 });
  });
});
