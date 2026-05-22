import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import extension from "./extension";

describe("pstdio-core-worktree-automation", () => {
  test("worktreeCreated creates a visible gitignore marker", async () => {
    const worktreePath = mkdtempSync(join(tmpdir(), "pstdio-core-worktree-"));
    const bootstraps: unknown[] = [];

    try {
      await extension.hooks?.worktreeCreated?.handler(
        {
          worktrees: {
            bootstrap: async (input: unknown) => {
              bootstraps.push(input);
            },
          },
        } as never,
        {
          branch: "workspace/PS-304",
          projectId: "project-1",
          repoPath: "/repo",
          ticket: "PS-304",
          workspace: "PS-304_A1",
          workspaceId: "workspace-1",
          worktreePath,
        },
      );

      expect(existsSync(join(worktreePath, ".gitignore"))).toBe(true);
      expect(bootstraps).toEqual([{ repoPath: "/repo", worktreePath, ticketId: "PS-304" }]);
    } finally {
      rmSync(worktreePath, { recursive: true, force: true });
    }
  });
});
