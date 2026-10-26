import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { git } from "./git";
import { getWorktreeStatus } from "./status";
import { createTempRepo } from "./test-helpers";
import { createWorktree } from "./worktree";

let repo: Awaited<ReturnType<typeof createTempRepo>>;

beforeEach(async () => {
  repo = await createTempRepo();
});

afterEach(async () => {
  await repo.cleanup();
});

describe("getWorktreeStatus", () => {
  test("reports clean worktree", async () => {
    const wtPath = join(repo.dir, "wt-status");
    await createWorktree({ repoRoot: repo.dir, branch: "task/status", path: wtPath });

    const status = await getWorktreeStatus({
      repoRoot: repo.dir,
      worktreePath: wtPath,
      base: "main",
    });

    expect(status.branch).toBe("task/status");
    expect(status.dirty).toBe(false);
    expect(status.conflicts).toBe(false);
    expect(status.aheadOfBase).toBe(0);
    expect(status.behindBase).toBe(0);
  });

  test("reports dirty worktree", async () => {
    const wtPath = join(repo.dir, "wt-status");
    await createWorktree({ repoRoot: repo.dir, branch: "task/dirty", path: wtPath });

    await Bun.write(join(wtPath, "new-file.txt"), "hello");

    const status = await getWorktreeStatus({
      repoRoot: repo.dir,
      worktreePath: wtPath,
      base: "main",
    });

    expect(status.dirty).toBe(true);
  });

  test("reports ahead count", async () => {
    const wtPath = join(repo.dir, "wt-status");
    await createWorktree({ repoRoot: repo.dir, branch: "task/ahead", path: wtPath });

    await Bun.write(join(wtPath, "new-file.txt"), "hello");
    await git(wtPath, ["add", "."]);
    await git(wtPath, ["commit", "-m", "new commit"]);

    const status = await getWorktreeStatus({
      repoRoot: repo.dir,
      worktreePath: wtPath,
      base: "main",
    });

    expect(status.aheadOfBase).toBe(1);
    expect(status.behindBase).toBe(0);
  });
});
