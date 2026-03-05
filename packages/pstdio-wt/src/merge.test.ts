import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { commitChanges } from "./commit";
import { git } from "./git";
import { mergeWorktree } from "./merge";
import { createTempRepo } from "./test-helpers";
import { createWorktree } from "./worktree";

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
});
