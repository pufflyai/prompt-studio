import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { branchExists, git } from "pstdio-wt";
import { cleanupWorkspaceWorktree } from "./worktree-cleanup";

test("cleanup of a migrated workspace does not guess ownership from its new reference", async () => {
  const repo = mkdtempSync(join(tmpdir(), "cleanup-ownership-"));
  try {
    await git(repo, ["init", "-b", "main"]);
    await git(repo, [
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.com",
      "commit",
      "--allow-empty",
      "-m",
      "init",
    ]);
    const path = join(repo, "legacy");
    await git(repo, ["worktree", "add", "-b", "workspace/old-name", path]);
    await git(repo, ["branch", "workspace/PS_WS-1"]);
    expect(
      await cleanupWorkspaceWorktree(
        { repoService: { listByProject: async () => [{ id: "repo", path: repo }] } } as never,
        { project_id: "project", workspace_shorthand: "PS_WS-1", branch: null, worktree_path: path },
      ),
    ).toBe(true);
    expect(await branchExists(repo, "workspace/PS_WS-1")).toBe(true);
    expect(await branchExists(repo, "workspace/old-name")).toBe(true);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
