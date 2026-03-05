import { describe, expect, test } from "bun:test";
import { nextWorkspaceShorthand } from "./next-workspace-shorthand";

describe("nextWorkspaceShorthand", () => {
  test("returns A1 for first workspace", () => {
    expect(nextWorkspaceShorthand("PS-12", 0)).toBe("PS-12_A1");
  });

  test("increments based on existing count", () => {
    expect(nextWorkspaceShorthand("PS-12", 2)).toBe("PS-12_A3");
  });

  test("works with different ticket shorthands", () => {
    expect(nextWorkspaceShorthand("MY-1", 0)).toBe("MY-1_A1");
  });
});
