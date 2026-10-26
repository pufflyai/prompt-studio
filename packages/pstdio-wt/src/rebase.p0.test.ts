import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { join } from "node:path";
import { commitChanges } from "./commit";
import { git } from "./git";
import { rebaseOntoTarget } from "./rebase";
import { createTempRepo } from "./test-helpers";
import type { HookDispatch } from "./types";
import { createWorktree } from "./worktree";

const noopDispatch = (): HookDispatch => ({
  firePreHook: mock(() => Promise.resolve({ rejected: false })),
  firePostHook: mock(() => Promise.resolve()),
});

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

  test("pre-rebase hook aborts rebase on failure", async () => {
    const wtPath = join(repo.dir, "wt-rebase");
    await createWorktree({ repoRoot: repo.dir, branch: "task/rebase-hook", path: wtPath });

    const dispatch: HookDispatch = {
      firePreHook: mock(() => Promise.resolve({ rejected: true, reason: "blocked" })),
      firePostHook: mock(() => Promise.resolve()),
    };

    await Bun.write(join(wtPath, "feature.txt"), "feature");
    await commitChanges({ worktreePath: wtPath, message: "branch commit" });

    // advance main so rebase is needed
    await Bun.write(join(repo.dir, "main-change.txt"), "main change");
    await git(repo.dir, ["add", "."]);
    await git(repo.dir, ["commit", "-m", "main commit"]);

    await expect(
      rebaseOntoTarget({ repoRoot: repo.dir, branch: "task/rebase-hook", target: "main", dispatch }),
    ).rejects.toThrow("HOOK preRebase FAILED");
  });

  test("on-conflict hook runs when rebase fails", async () => {
    const wtPath = join(repo.dir, "wt-rebase");
    await createWorktree({ repoRoot: repo.dir, branch: "task/rebase-conflict", path: wtPath });

    const dispatch = noopDispatch();

    // both sides modify the same file
    await Bun.write(join(wtPath, "README.md"), "branch version");
    await commitChanges({ worktreePath: wtPath, message: "branch change" });

    await Bun.write(join(repo.dir, "README.md"), "main version");
    await git(repo.dir, ["add", "."]);
    await git(repo.dir, ["commit", "-m", "main change"]);

    await expect(
      rebaseOntoTarget({ repoRoot: repo.dir, branch: "task/rebase-conflict", target: "main", dispatch }),
    ).rejects.toThrow();

    expect(dispatch.firePostHook).toHaveBeenCalledWith(
      "onConflict",
      expect.objectContaining({
        repoPath: repo.dir,
        branch: "task/rebase-conflict",
        target: "main",
        operation: "rebase",
      }),
    );
  });

  test("post-rebase hook runs after successful rebase", async () => {
    const wtPath = join(repo.dir, "wt-rebase");
    await createWorktree({ repoRoot: repo.dir, branch: "task/rebase-post", path: wtPath });

    const dispatch = noopDispatch();

    await Bun.write(join(wtPath, "feature.txt"), "feature");
    await commitChanges({ worktreePath: wtPath, message: "branch commit" });

    // advance main so rebase is needed
    await Bun.write(join(repo.dir, "main-change.txt"), "main change");
    await git(repo.dir, ["add", "."]);
    await git(repo.dir, ["commit", "-m", "main commit"]);

    await rebaseOntoTarget({ repoRoot: repo.dir, branch: "task/rebase-post", target: "main", dispatch });

    expect(dispatch.firePostHook).toHaveBeenCalledWith(
      "postRebase",
      expect.objectContaining({
        repoPath: repo.dir,
        branch: "task/rebase-post",
        target: "main",
      }),
    );
  });

  test("dispatch ctx contains expected fields", async () => {
    const wtPath = join(repo.dir, "wt-rebase");
    await createWorktree({ repoRoot: repo.dir, branch: "task/rebase-payload", path: wtPath });

    const dispatch = noopDispatch();

    await Bun.write(join(wtPath, "feature.txt"), "feature");
    await commitChanges({ worktreePath: wtPath, message: "branch commit" });

    await Bun.write(join(repo.dir, "main-change.txt"), "main change");
    await git(repo.dir, ["add", "."]);
    await git(repo.dir, ["commit", "-m", "main commit"]);

    await rebaseOntoTarget({
      repoRoot: repo.dir,
      branch: "task/rebase-payload",
      target: "main",
      dispatch,
    });

    expect(dispatch.firePreHook).toHaveBeenCalledWith("preRebase", {
      repoPath: repo.dir,
      branch: "task/rebase-payload",
      target: "main",
    });

    expect(dispatch.firePostHook).toHaveBeenCalledWith("postRebase", {
      repoPath: repo.dir,
      branch: "task/rebase-payload",
      target: "main",
    });
  });
});
