import { describe, expect, it } from "bun:test";
import { resolvePendingWorkspaceSessionWorkspaceId } from "./workspace-page.utils";

describe("resolvePendingWorkspaceSessionWorkspaceId", () => {
  it("keeps the pending draft when it matches the selected workspace", () => {
    expect(resolvePendingWorkspaceSessionWorkspaceId("workspace-1", "workspace-1")).toBe("workspace-1");
  });

  it("clears the pending draft when switching to another workspace", () => {
    expect(resolvePendingWorkspaceSessionWorkspaceId("workspace-1", "workspace-2")).toBeNull();
  });

  it("clears the pending draft when leaving workspace context", () => {
    expect(resolvePendingWorkspaceSessionWorkspaceId("workspace-1", null)).toBeNull();
  });
});
