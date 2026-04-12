import { describe, expect, it } from "bun:test";
import { getAttemptLabelFromWorkspaceShorthand } from "./workspace-shorthand";

describe("getAttemptLabelFromWorkspaceShorthand", () => {
  it("returns the attempt suffix for ticket workspaces", () => {
    expect(getAttemptLabelFromWorkspaceShorthand("PS-29_A1")).toBe("A1");
  });

  it("returns the original shorthand when no attempt suffix exists", () => {
    expect(getAttemptLabelFromWorkspaceShorthand("PS-29")).toBe("PS-29");
  });

  it("returns the original shorthand when suffix is empty", () => {
    expect(getAttemptLabelFromWorkspaceShorthand("PS-29_")).toBe("PS-29_");
  });
});
