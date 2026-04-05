import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { join } from "node:path";
import { commitChanges } from "./commit";
import { git } from "./git";
import { mergeWorktree } from "./merge";
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

describe("mergeWorktree", () => {
  test("fast-forward merges a branch into target", async () => {
    const wtPath = join(repo.dir, "wt-merge");
    await createWorktree({ repoRoot: repo.dir, branch: "task/merge", path: wtPath });

    await Bun.write(join(wtPath, "feature.txt"), "feature content");
    await commitChanges({ worktreePath: wtPath, message: "add feature" });

    const result = await mergeWorktree({
      repoRoot: repo.dir,
      branch: "task/merge",
      target: "main",
    });

    expect(result.merged).toBe(true);
    expect(result.target).toBe("main");
    expect(result.sha).toHaveLength(40);

    const mainLog = await git(repo.dir, ["log", "-1", "--format=%s"]);
    expect(mainLog).toBe("add feature");
  });

  test("squash merges a diverged branch", async () => {
    const wtPath = join(repo.dir, "wt-merge");
    await createWorktree({ repoRoot: repo.dir, branch: "task/diverge", path: wtPath });

    // commit on the worktree branch
    await Bun.write(join(wtPath, "feature.txt"), "feature");
    await commitChanges({ worktreePath: wtPath, message: "branch commit" });

    // commit on main to diverge
    await Bun.write(join(repo.dir, "main-change.txt"), "main change");
    await git(repo.dir, ["add", "."]);
    await git(repo.dir, ["commit", "-m", "main commit"]);

    const result = await mergeWorktree({
      repoRoot: repo.dir,
      branch: "task/diverge",
      target: "main",
      squash: true,
    });

    expect(result.merged).toBe(true);
    expect(result.target).toBe("main");
  });

  test("fails ff-only merge on diverged branches", async () => {
    const wtPath = join(repo.dir, "wt-merge");
    await createWorktree({ repoRoot: repo.dir, branch: "task/diverge2", path: wtPath });

    await Bun.write(join(wtPath, "feature.txt"), "feature");
    await commitChanges({ worktreePath: wtPath, message: "branch commit" });

    await Bun.write(join(repo.dir, "main-change.txt"), "main change");
    await git(repo.dir, ["add", "."]);
    await git(repo.dir, ["commit", "-m", "main commit"]);

    await expect(
      mergeWorktree({
        repoRoot: repo.dir,
        branch: "task/diverge2",
        target: "main",
      }),
    ).rejects.toThrow("Merge of task/diverge2 into main failed");
  });

  test("pre-merge hook aborts merge on failure", async () => {
    const wtPath = join(repo.dir, "wt-merge");
    await createWorktree({ repoRoot: repo.dir, branch: "task/hook-fail", path: wtPath });

    const dispatch: HookDispatch = {
      firePreHook: mock(() => Promise.resolve({ rejected: true, reason: "blocked" })),
      firePostHook: mock(() => Promise.resolve()),
    };

    await Bun.write(join(wtPath, "feature.txt"), "feature");
    await commitChanges({ worktreePath: wtPath, message: "add feature" });

    await expect(
      mergeWorktree({ repoRoot: repo.dir, branch: "task/hook-fail", target: "main", dispatch }),
    ).rejects.toThrow("HOOK preMerge FAILED");
  });

  test("post-merge hook runs after successful merge", async () => {
    const wtPath = join(repo.dir, "wt-merge");
    await createWorktree({ repoRoot: repo.dir, branch: "task/hook-post", path: wtPath });

    const dispatch = noopDispatch();

    await Bun.write(join(wtPath, "feature.txt"), "feature");
    await commitChanges({ worktreePath: wtPath, message: "add feature" });

    await mergeWorktree({ repoRoot: repo.dir, branch: "task/hook-post", target: "main", dispatch });

    expect(dispatch.firePostHook).toHaveBeenCalledWith(
      "postMerge",
      expect.objectContaining({
        repoPath: repo.dir,
        branch: "task/hook-post",
        target: "main",
      }),
    );
  });

  test("on-conflict hook runs when merge fails", async () => {
    const wtPath = join(repo.dir, "wt-merge");
    await createWorktree({ repoRoot: repo.dir, branch: "task/conflict", path: wtPath });

    const dispatch = noopDispatch();

    await Bun.write(join(wtPath, "feature.txt"), "feature");
    await commitChanges({ worktreePath: wtPath, message: "branch commit" });

    await Bun.write(join(repo.dir, "main-change.txt"), "main change");
    await git(repo.dir, ["add", "."]);
    await git(repo.dir, ["commit", "-m", "main commit"]);

    await expect(
      mergeWorktree({ repoRoot: repo.dir, branch: "task/conflict", target: "main", dispatch }),
    ).rejects.toThrow();

    expect(dispatch.firePostHook).toHaveBeenCalledWith(
      "onConflict",
      expect.objectContaining({
        repoPath: repo.dir,
        branch: "task/conflict",
        target: "main",
        operation: "merge",
      }),
    );
  });

  test("dispatch ctx contains expected fields", async () => {
    const wtPath = join(repo.dir, "wt-merge");
    await createWorktree({ repoRoot: repo.dir, branch: "task/merge-payload", path: wtPath });

    const dispatch = noopDispatch();

    await Bun.write(join(wtPath, "feature.txt"), "feature");
    await commitChanges({ worktreePath: wtPath, message: "add feature" });

    await mergeWorktree({
      repoRoot: repo.dir,
      branch: "task/merge-payload",
      target: "main",
      dispatch,
    });

    expect(dispatch.firePreHook).toHaveBeenCalledWith("preMerge", {
      repoPath: repo.dir,
      branch: "task/merge-payload",
      target: "main",
      squash: false,
      commitMessage: null,
    });

    expect(dispatch.firePostHook).toHaveBeenCalledWith(
      "postMerge",
      expect.objectContaining({
        repoPath: repo.dir,
        branch: "task/merge-payload",
        target: "main",
        squash: false,
        commitSha: expect.stringMatching(/^[0-9a-f]{40}$/),
      }),
    );
  });
});
