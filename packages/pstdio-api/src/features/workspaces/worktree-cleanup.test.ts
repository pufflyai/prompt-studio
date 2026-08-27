import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanupWorkspaceWorktree } from "./worktree-cleanup";
import { resolveWorkspacesRoot } from "./worktree-setup";

describe("cleanupWorkspaceWorktree", () => {
  test("treats an already-missing worktree as cleaned", async () => {
    const repoPath = mkdtempSync(join(tmpdir(), "pstdio-workspace-missing-cleanup-"));
    const missingWorktreePath = join(repoPath, ".worktrees", "missing");

    try {
      const removed = await cleanupWorkspaceWorktree(
        {
          repoService: {
            listByProject: async () => [{ id: "repo-1", path: repoPath }],
          },
        } as never,
        {
          project_id: "project-1",
          workspace_shorthand: "WS-1",
          branch: "workspace/WS-1",
          worktree_path: missingWorktreePath,
        },
      );

      expect(removed).toBe(true);
    } finally {
      rmSync(repoPath, { recursive: true, force: true });
    }
  });

  test("removes an orphaned managed worktree when its repository is gone", async () => {
    const missingRepoPath = join(tmpdir(), `pstdio-missing-repo-${crypto.randomUUID()}`);
    const worktreePath = join(resolveWorkspacesRoot(), `orphan-${crypto.randomUUID()}`);
    mkdirSync(worktreePath, { recursive: true });

    try {
      const removed = await cleanupWorkspaceWorktree(
        {
          repoService: {
            listByProject: async () => [{ id: "repo-1", path: missingRepoPath }],
          },
        } as never,
        {
          project_id: "project-1",
          workspace_shorthand: "WS-1",
          branch: "workspace/WS-1",
          worktree_path: worktreePath,
        },
      );

      expect(removed).toBe(true);
      expect(existsSync(worktreePath)).toBe(false);
    } finally {
      rmSync(worktreePath, { recursive: true, force: true });
    }
  });

  test("never removes a registered repository root", async () => {
    const repoPath = mkdtempSync(join(tmpdir(), "pstdio-workspace-root-cleanup-"));
    try {
      const removed = await cleanupWorkspaceWorktree(
        {
          repoService: {
            listByProject: async () => [{ id: "repo-1", path: repoPath }],
          },
        } as never,
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
