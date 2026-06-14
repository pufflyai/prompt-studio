import { describe, expect, test } from "bun:test";
import { createWorkspaceBadgeResource, normalizeWorkspaceBadgeItems } from "./extension-workspace-badge-renderer";

describe("extension workspace badge renderer", () => {
  test("normalizes serializable workspace payloads", () => {
    expect(
      normalizeWorkspaceBadgeItems([
        {
          id: "workspace-2",
          name: "Latest attempt",
          shorthand: "T-1_A2",
          type: "current_branch",
          createdAt: "2026-01-03T00:00:00.000Z",
        },
        { id: "workspace-1", shorthand: "T-1_A1", type: "worktree" },
        { id: "", name: "missing" },
        "not-a-workspace",
      ]),
    ).toEqual([
      {
        id: "workspace-2",
        name: "Latest attempt",
        shorthand: "T-1_A2",
        type: "current_branch",
        createdAt: "2026-01-03T00:00:00.000Z",
      },
      { id: "workspace-1", name: "T-1_A1", shorthand: "T-1_A1", type: "worktree" },
    ]);
  });

  test("creates native workspace resources from badge items", () => {
    const resource = createWorkspaceBadgeResource(
      { id: "workspace-2", name: "Latest attempt", shorthand: "T-1_A2", type: "current_branch" },
      "project-1",
    );

    expect(resource).toMatchObject({
      kind: "workspace",
      id: "workspace-2",
      label: "Latest attempt",
      icon: "GitBranch",
      metadata: {
        workspaceId: "workspace-2",
        workspaceShorthand: "T-1_A2",
        workspaceType: "current_branch",
      },
    });
  });
});
