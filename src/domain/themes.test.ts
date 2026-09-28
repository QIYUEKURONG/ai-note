import { describe, expect, it } from "vitest";
import { isThemePreset, themeFromPreset, THEME_PRESETS } from "./themes";

describe("themes", () => {
  it("has eight presets", () => {
    expect(Object.keys(THEME_PRESETS)).toHaveLength(8);
  });

  it("builds css-ready theme from preset", () => {
    const theme = themeFromPreset("paper");
    expect(theme.background).toBe(THEME_PRESETS.paper.background);
    expect(isThemePreset("cyber")).toBe(true);
    expect(isThemePreset("neon")).toBe(false);
  });
});
