import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { exec } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { createGitWorktreeService } from "./git-worktree";

const execAsync = promisify(exec);
const git = async (cwd: string, args: string) => {
  const { stdout } = await execAsync(`git ${args}`, { cwd });
  return stdout.trim();
};

let repoRoot: string;
const service = createGitWorktreeService();

beforeAll(async () => {
  repoRoot = await mkdtemp(join(tmpdir(), "git-worktree-test-"));
  await git(repoRoot, "init");
  await git(repoRoot, 'config user.email "test@test.com"');
  await git(repoRoot, 'config user.name "Test"');
  await execAsync("echo hello > file.txt", { cwd: repoRoot });
  await git(repoRoot, "add .");
  await git(repoRoot, 'commit -m "initial"');
});

afterAll(async () => {
  await rm(repoRoot, { recursive: true, force: true });
});

describe("createGitWorktreeService", () => {
  test("isCleanWorkingTree returns true for clean repo", async () => {
    expect(await service.isCleanWorkingTree(repoRoot)).toBe(true);
  });

  test("getCurrentBranchOrCommit returns branch name", async () => {
    const branch = await service.getCurrentBranchOrCommit(repoRoot);
    expect(["main", "master"]).toContain(branch);
  });

  test("refExists checks if ref exists", async () => {
    expect(await service.refExists(repoRoot, "HEAD")).toBe(true);
    expect(await service.refExists(repoRoot, "nonexistent-branch")).toBe(false);
  });

  test("createWorktree and removeWorktree", async () => {
    const wtPath = join(repoRoot, ".pstdio/workspaces/PS-1_A1");
    await service.createWorktree(repoRoot, wtPath, "workspace/PS-1_A1", "HEAD");

    const branch = await git(wtPath, "symbolic-ref --short HEAD");
    expect(branch).toBe("workspace/PS-1_A1");

    await service.removeWorktree(repoRoot, wtPath);
    await service.deleteBranch(repoRoot, "workspace/PS-1_A1");
  });

  test("squashMerge merges branch into current", async () => {
    // Create a feature branch with a commit
    await git(repoRoot, "checkout -b test-feature");
    await execAsync("echo feature > feature.txt", { cwd: repoRoot });
    await git(repoRoot, "add .");
    await git(repoRoot, 'commit -m "feature commit"');

    // Go back to main and squash merge
    const mainBranch = (await service.refExists(repoRoot, "main")) ? "main" : "master";
    await git(repoRoot, `checkout ${mainBranch}`);
    await service.squashMerge(repoRoot, "test-feature", "workspace(PS-1_A1): squash merge");

    const log = await git(repoRoot, "log --oneline -1");
    expect(log).toContain("workspace(PS-1_A1): squash merge");

    await service.deleteBranch(repoRoot, "test-feature");
  });
});
