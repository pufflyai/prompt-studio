import { describe, expect, test } from "bun:test";
import type { ExtensionWorkspace } from "@pstdio/sdk/extensions";
import { createTicketWorkspaceLookup } from "./mappers";

describe("ticket workspace badges", () => {
  test.each([
    {
      name: "project folder",
      provider_id: "pstdio.root",
      execution_kind: "local" as const,
      root_path: "/documents",
      icon: "Folder",
      workspaceType: "folder",
    },
    {
      name: "Git worktree",
      provider_id: "pstdio.worktree",
      execution_kind: "local" as const,
      root_path: "/worktrees/attempt",
      icon: "GitBranch",
      workspaceType: "worktree",
    },
    {
      name: "Git worktree awaiting its folder",
      provider_id: "pstdio.worktree",
      execution_kind: "local" as const,
      root_path: null,
      icon: "GitBranch",
      workspaceType: "worktree",
    },
    {
      name: "remote workspace",
      provider_id: "example.cloud",
      execution_kind: "remote" as const,
      root_path: null,
      icon: "Cloud",
      workspaceType: "remote",
    },
  ])("shows the provider identity for a $name", ({ icon, workspaceType, ...target }) => {
    const workspace: ExtensionWorkspace = {
      id: "workspace-1",
      workspace_shorthand: "T-1_A1",
      ...target,
    };

    const badge = createTicketWorkspaceLookup([workspace]).get("T-1")?.[0];

    expect(badge).toMatchObject({
      id: workspace.id,
      icon,
      resource: {
        type: "workspace",
        id: workspace.id,
        metadata: { workspaceId: workspace.id, workspaceType },
      },
    });
  });
});
