import { describe, expect, it } from "vitest";
import { isOrganizeKind, ORGANIZE_KINDS } from "./organize-kinds";

describe("organize kinds", () => {
  it("includes the structure kinds", () => {
    expect(ORGANIZE_KINDS).toHaveLength(23);
    expect(isOrganizeKind("structured")).toBe(true);
    expect(isOrganizeKind("structure_only")).toBe(true);
    expect(isOrganizeKind("quote_cards")).toBe(true);
    expect(isOrganizeKind("podcast")).toBe(false);
  });
});
