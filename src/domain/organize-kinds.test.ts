import { describe, expect, it } from "vitest";
import { isOrganizeKind, ORGANIZE_KINDS } from "./organize-kinds";

describe("organize kinds", () => {
  it("includes fifteen kinds", () => {
    expect(ORGANIZE_KINDS).toHaveLength(15);
    expect(isOrganizeKind("structured")).toBe(true);
    expect(isOrganizeKind("podcast")).toBe(false);
  });
});
