import { describe, expect, it } from "bun:test";
import { resolveWorkspaceDiffTotalLabel } from "./workspace-diff-total";

describe("resolveWorkspaceDiffTotalLabel", () => {
  it("returns a signed additions and deletions label", () => {
    const label = resolveWorkspaceDiffTotalLabel(
      new Map([["workspace-1", { additions: 14, deletions: 3 }]]),
      "workspace-1",
    );

    expect(label).toBe("+14 -3");
  });

  it("returns null when workspace has no diff totals", () => {
    const label = resolveWorkspaceDiffTotalLabel(new Map(), "workspace-1");

    expect(label).toBeNull();
  });
});
