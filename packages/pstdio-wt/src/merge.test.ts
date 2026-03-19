import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { commitChanges } from "./commit";
import { git } from "./git";
import { mergeWorktree } from "./merge";
import { createTempRepo } from "./test-helpers";
import { createWorktree } from "./worktree";

const writeHook = (repoPath: string, hookName: string, script: string) => {
  const hooksDir = join(repoPath, ".pstdio", "hooks");
  mkdirSync(hooksDir, { recursive: true });
  writeFileSync(join(hooksDir, hookName), script);
};

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
    writeHook(repo.dir, "pre-merge", "exit 1");

    await Bun.write(join(wtPath, "feature.txt"), "feature");
    await commitChanges({ worktreePath: wtPath, message: "add feature" });

    await expect(mergeWorktree({ repoRoot: repo.dir, branch: "task/hook-fail", target: "main" })).rejects.toThrow(
      "HOOK pre-merge FAILED",
    );
  });

  test("post-merge hook runs after successful merge", async () => {
    const wtPath = join(repo.dir, "wt-merge");
    await createWorktree({ repoRoot: repo.dir, branch: "task/hook-post", path: wtPath });
    writeHook(repo.dir, "post-merge", `echo "done" > "${repo.dir}/post-merge-marker.txt"`);

    await Bun.write(join(wtPath, "feature.txt"), "feature");
    await commitChanges({ worktreePath: wtPath, message: "add feature" });

    await mergeWorktree({ repoRoot: repo.dir, branch: "task/hook-post", target: "main" });

    await new Promise((r) => setTimeout(r, 200));
    expect(existsSync(join(repo.dir, "post-merge-marker.txt"))).toBe(true);
  });

  test("on-conflict hook runs when merge fails", async () => {
    const wtPath = join(repo.dir, "wt-merge");
    await createWorktree({ repoRoot: repo.dir, branch: "task/conflict", path: wtPath });
    writeHook(repo.dir, "on-conflict", `echo "conflict" > "${repo.dir}/conflict-marker.txt"`);

    await Bun.write(join(wtPath, "feature.txt"), "feature");
    await commitChanges({ worktreePath: wtPath, message: "branch commit" });

    await Bun.write(join(repo.dir, "main-change.txt"), "main change");
    await git(repo.dir, ["add", "."]);
    await git(repo.dir, ["commit", "-m", "main commit"]);

    await expect(mergeWorktree({ repoRoot: repo.dir, branch: "task/conflict", target: "main" })).rejects.toThrow();

    await new Promise((r) => setTimeout(r, 200));
    expect(existsSync(join(repo.dir, "conflict-marker.txt"))).toBe(true);
  });
});
