import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { commitChanges } from "./commit";
import { git } from "./git";
import { rebaseOntoTarget } from "./rebase";
import { createTempRepo } from "./test-helpers";
import { createWorktree } from "./worktree";

let repo: Awaited<ReturnType<typeof createTempRepo>>;

beforeEach(async () => {
  repo = await createTempRepo();
});

afterEach(async () => {
  await repo.cleanup();
});

describe("rebaseOntoTarget", () => {
  test("no-op when branch is already up-to-date", async () => {
    const wtPath = join(repo.dir, "wt-rebase");
    await createWorktree({ repoRoot: repo.dir, branch: "task/rebase-1", path: wtPath });

    await Bun.write(join(wtPath, "feature.txt"), "feature");
    await commitChanges({ worktreePath: wtPath, message: "branch commit" });

    const result = await rebaseOntoTarget({
      repoRoot: repo.dir,
      branch: "task/rebase-1",
      target: "main",
    });

    expect(result.rebased).toBe(true);
    expect(result.upToDate).toBe(true);
  });

  test("rebases branch onto advanced target", async () => {
    const wtPath = join(repo.dir, "wt-rebase");
    await createWorktree({ repoRoot: repo.dir, branch: "task/rebase-2", path: wtPath });

    // commit on the worktree branch
    await Bun.write(join(wtPath, "feature.txt"), "feature");
    await commitChanges({ worktreePath: wtPath, message: "branch commit" });

    // advance main
    await Bun.write(join(repo.dir, "main-change.txt"), "main change");
    await git(repo.dir, ["add", "."]);
    await git(repo.dir, ["commit", "-m", "main commit"]);

    const result = await rebaseOntoTarget({
      repoRoot: repo.dir,
      branch: "task/rebase-2",
      target: "main",
    });

    expect(result.rebased).toBe(true);
    expect(result.upToDate).toBe(false);

    // after rebase, ff-only merge should work
    await git(repo.dir, ["checkout", "main"]);
    await git(repo.dir, ["merge", "--ff-only", "task/rebase-2"]);
    const log = await git(repo.dir, ["log", "--oneline", "--all"]);
    expect(log).toContain("branch commit");
    expect(log).toContain("main commit");
  });

  test("fails on conflict", async () => {
    const wtPath = join(repo.dir, "wt-rebase");
    await createWorktree({ repoRoot: repo.dir, branch: "task/rebase-3", path: wtPath });

    // both sides modify the same file
    await Bun.write(join(wtPath, "README.md"), "branch version");
    await commitChanges({ worktreePath: wtPath, message: "branch change" });

    await Bun.write(join(repo.dir, "README.md"), "main version");
    await git(repo.dir, ["add", "."]);
    await git(repo.dir, ["commit", "-m", "main change"]);

    await expect(
      rebaseOntoTarget({
        repoRoot: repo.dir,
        branch: "task/rebase-3",
        target: "main",
      }),
    ).rejects.toThrow("Rebase of task/rebase-3 onto main failed");
  });

  test("defaults target to current branch", async () => {
    const wtPath = join(repo.dir, "wt-rebase");
    await createWorktree({ repoRoot: repo.dir, branch: "task/rebase-4", path: wtPath });

    await Bun.write(join(wtPath, "feature.txt"), "feature");
    await commitChanges({ worktreePath: wtPath, message: "branch commit" });

    // we're on main, so target defaults to main
    const result = await rebaseOntoTarget({
      repoRoot: repo.dir,
      branch: "task/rebase-4",
    });

    expect(result.rebased).toBe(true);
  });
});
