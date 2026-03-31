import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { git } from "./git";
import { createTempRepo } from "./test-helpers";
import {
  branchExists,
  createWorktree,
  findWorktreeByBranch,
  listWorktrees,
  removeWorktree,
  removeWorktreeAndBranch,
  worktreePath,
} from "./worktree";

let repo: Awaited<ReturnType<typeof createTempRepo>>;

beforeEach(async () => {
  repo = await createTempRepo();
});

afterEach(async () => {
  await repo.cleanup();
});

describe("listWorktrees", () => {
  test("lists the main worktree", async () => {
    const entries = await listWorktrees(repo.dir);
    expect(entries.length).toBe(1);
    expect(entries[0].branch).toBe("main");
  });
});

describe("createWorktree", () => {
  test("creates a new worktree and branch", async () => {
    const wtPath = join(repo.dir, "wt-test");
    const result = await createWorktree({
      repoRoot: repo.dir,
      branch: "task/test-1",
      path: wtPath,
    });

    expect(result.created).toBe(true);
    expect(result.branch).toBe("task/test-1");
    expect(result.path).toBe(wtPath);
  });

  test("is idempotent — returns existing worktree", async () => {
    const wtPath = join(repo.dir, "wt-test");
    await createWorktree({ repoRoot: repo.dir, branch: "task/test-1", path: wtPath });

    const result = await createWorktree({
      repoRoot: repo.dir,
      branch: "task/test-1",
      path: join(repo.dir, "wt-test-2"),
    });

    expect(result.created).toBe(false);
    expect(result.path).toBe(wtPath);
  });

  test("deletes stale branch and creates fresh worktree from requested base", async () => {
    // Create a branch at the initial commit, then add a new commit to main
    const initialSha = await git(repo.dir, ["rev-parse", "HEAD"]);
    await git(repo.dir, ["branch", "task/stale"]);

    await Bun.write(join(repo.dir, "new-file.txt"), "new");
    await git(repo.dir, ["add", "new-file.txt"]);
    await git(repo.dir, ["commit", "-m", "advance main"]);
    const advancedSha = await git(repo.dir, ["rev-parse", "HEAD"]);

    // Stale branch is behind main
    const staleSha = await git(repo.dir, ["rev-parse", "task/stale"]);
    expect(staleSha).toBe(initialSha);

    // Creating a worktree with the stale branch name should recreate from the new base
    const wtPath = join(repo.dir, "wt-stale");
    const result = await createWorktree({
      repoRoot: repo.dir,
      branch: "task/stale",
      path: wtPath,
      base: "main",
    });

    expect(result.created).toBe(true);

    // The worktree HEAD should be at the advanced main commit, not the stale one
    const worktreeHead = await git(wtPath, ["rev-parse", "HEAD"]);
    expect(worktreeHead).toBe(advancedSha);
  });

  test("creates from a specific base", async () => {
    const wtPath = join(repo.dir, "wt-test");
    const result = await createWorktree({
      repoRoot: repo.dir,
      branch: "task/test-1",
      path: wtPath,
      base: "main",
    });

    expect(result.created).toBe(true);
    expect(result.base).toBe("main");
  });
});

describe("findWorktreeByBranch", () => {
  test("returns null when branch has no worktree", async () => {
    const result = await findWorktreeByBranch(repo.dir, "nonexistent");
    expect(result).toBeNull();
  });

  test("returns entry when found", async () => {
    const wtPath = join(repo.dir, "wt-test");
    await createWorktree({ repoRoot: repo.dir, branch: "task/find-me", path: wtPath });

    const result = await findWorktreeByBranch(repo.dir, "task/find-me");
    expect(result).not.toBeNull();
    expect(result!.worktree).toBe(wtPath);
  });
});

describe("removeWorktreeAndBranch", () => {
  test("removes worktree and branch", async () => {
    const wtPath = join(repo.dir, "wt-test");
    await createWorktree({ repoRoot: repo.dir, branch: "task/rm-me", path: wtPath });

    await removeWorktreeAndBranch({
      repoRoot: repo.dir,
      path: wtPath,
      branch: "task/rm-me",
    });

    const found = await findWorktreeByBranch(repo.dir, "task/rm-me");
    expect(found).toBeNull();
  });
});

describe("removeWorktree", () => {
  test("refuses to remove dirty worktree without force", async () => {
    const wtPath = join(repo.dir, "wt-dirty");
    await createWorktree({ repoRoot: repo.dir, branch: "task/dirty", path: wtPath });

    await Bun.write(join(wtPath, "uncommitted.txt"), "dirty");

    await expect(removeWorktree({ repoRoot: repo.dir, path: wtPath })).rejects.toThrow("has uncommitted changes");
  });

  test("removes dirty worktree with force", async () => {
    const wtPath = join(repo.dir, "wt-dirty");
    await createWorktree({ repoRoot: repo.dir, branch: "task/dirty-force", path: wtPath });

    await Bun.write(join(wtPath, "uncommitted.txt"), "dirty");

    await removeWorktree({ repoRoot: repo.dir, path: wtPath, force: true });

    const found = await findWorktreeByBranch(repo.dir, "task/dirty-force");
    expect(found).toBeNull();
  });

  test("removes clean worktree without force", async () => {
    const wtPath = join(repo.dir, "wt-clean");
    await createWorktree({ repoRoot: repo.dir, branch: "task/clean", path: wtPath });

    await removeWorktree({ repoRoot: repo.dir, path: wtPath });

    const found = await findWorktreeByBranch(repo.dir, "task/clean");
    expect(found).toBeNull();
  });
});

describe("branchExists", () => {
  test("returns true for existing branch", async () => {
    const wtPath = join(repo.dir, "wt-exists");
    await createWorktree({ repoRoot: repo.dir, branch: "task/exists", path: wtPath });

    expect(await branchExists(repo.dir, "task/exists")).toBe(true);
  });

  test("returns false for nonexistent branch", async () => {
    expect(await branchExists(repo.dir, "task/nope")).toBe(false);
  });

  test("returns true for branch without worktree", async () => {
    // create a branch via git directly (no worktree)
    await git(repo.dir, ["branch", "orphan-branch"]);

    expect(await branchExists(repo.dir, "orphan-branch")).toBe(true);

    // but no worktree for it
    const wt = await findWorktreeByBranch(repo.dir, "orphan-branch");
    expect(wt).toBeNull();
  });
});

describe("worktreePath", () => {
  test("sanitizes branch name for path", () => {
    expect(worktreePath("/base", "task/my-feature")).toBe("/base/task_my-feature");
    expect(worktreePath("/base", "simple")).toBe("/base/simple");
  });
});
