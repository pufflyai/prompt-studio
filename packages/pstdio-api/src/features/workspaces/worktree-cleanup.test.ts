import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanupWorkspaceWorktree } from "./worktree-cleanup";

describe("cleanupWorkspaceWorktree", () => {
  test("never removes a registered repository root", async () => {
    const repoPath = mkdtempSync(join(tmpdir(), "pstdio-workspace-root-cleanup-"));
    try {
      const removed = await cleanupWorkspaceWorktree(
        { repoService: { listByProject: async () => [{ id: "repo-1", path: repoPath }] } } as never,
        {
          project_id: "project-1",
          workspace_shorthand: "WS-1",
          branch: "main",
          worktree_path: repoPath,
        },
      );

      expect(removed).toBe(false);
      expect(existsSync(repoPath)).toBe(true);
    } finally {
      rmSync(repoPath, { recursive: true, force: true });
    }
  });
});
