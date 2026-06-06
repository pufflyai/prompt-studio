import { describe, expect, test } from "bun:test";
import extension from "./extension";

describe("pstdio worktree setup extension", () => {
  test("bootstraps worktrees without ticket-specific copying", async () => {
    const bootstraps: unknown[] = [];

    await extension.hooks?.worktreeCreated.handler(
      {
        worktrees: {
          bootstrap: async (input: unknown) => {
            bootstraps.push(input);
          },
        },
      } as never,
      {
        branch: "workspace/PS-1_A1",
        projectId: "project-1",
        repoPath: "/repo",
        ticket: "PS-1",
        workspace: "PS-1_A1",
        workspaceId: "workspace-1",
        worktreePath: "/worktree",
      },
    );

    expect(bootstraps).toEqual([{ repoPath: "/repo", worktreePath: "/worktree" }]);
  });
});
