import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { commitChanges } from "./commit";
import { git } from "./git";
import { rebaseOntoTarget } from "./rebase";
import { createTempRepo } from "./test-helpers";
import { createWorktree } from "./worktree";

const writeHook = (repoPath: string, hookName: string, script: string) => {
  const hooksDir = join(repoPath, ".pstdio", "hooks");
  mkdirSync(hooksDir, { recursive: true });
  const path = join(hooksDir, hookName);
  writeFileSync(path, `#!/bin/sh\n${script}`);
  chmodSync(path, 0o755);
};

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
    writeHook(repo.dir, "pre-rebase", "exit 1");

    await Bun.write(join(wtPath, "feature.txt"), "feature");
    await commitChanges({ worktreePath: wtPath, message: "branch commit" });

    // advance main so rebase is needed
    await Bun.write(join(repo.dir, "main-change.txt"), "main change");
    await git(repo.dir, ["add", "."]);
    await git(repo.dir, ["commit", "-m", "main commit"]);

    await expect(rebaseOntoTarget({ repoRoot: repo.dir, branch: "task/rebase-hook", target: "main" })).rejects.toThrow(
      "HOOK pre-rebase FAILED",
    );
  });

  test("on-conflict hook runs when rebase fails", async () => {
    const wtPath = join(repo.dir, "wt-rebase");
    await createWorktree({ repoRoot: repo.dir, branch: "task/rebase-conflict", path: wtPath });
    writeHook(repo.dir, "on-conflict", `echo "conflict" > "${repo.dir}/rebase-conflict-marker.txt"`);

    // both sides modify the same file
    await Bun.write(join(wtPath, "README.md"), "branch version");
    await commitChanges({ worktreePath: wtPath, message: "branch change" });

    await Bun.write(join(repo.dir, "README.md"), "main version");
    await git(repo.dir, ["add", "."]);
    await git(repo.dir, ["commit", "-m", "main change"]);

    await expect(
      rebaseOntoTarget({ repoRoot: repo.dir, branch: "task/rebase-conflict", target: "main" }),
    ).rejects.toThrow();

    await new Promise((r) => setTimeout(r, 500));
    expect(existsSync(join(repo.dir, "rebase-conflict-marker.txt"))).toBe(true);
  });

  test("post-rebase hook runs after successful rebase", async () => {
    const wtPath = join(repo.dir, "wt-rebase");
    await createWorktree({ repoRoot: repo.dir, branch: "task/rebase-post", path: wtPath });
    writeHook(repo.dir, "post-rebase", `echo "done" > "${repo.dir}/post-rebase-marker.txt"`);

    await Bun.write(join(wtPath, "feature.txt"), "feature");
    await commitChanges({ worktreePath: wtPath, message: "branch commit" });

    // advance main so rebase is needed
    await Bun.write(join(repo.dir, "main-change.txt"), "main change");
    await git(repo.dir, ["add", "."]);
    await git(repo.dir, ["commit", "-m", "main commit"]);

    await rebaseOntoTarget({ repoRoot: repo.dir, branch: "task/rebase-post", target: "main" });

    await new Promise((r) => setTimeout(r, 500));
    expect(existsSync(join(repo.dir, "post-rebase-marker.txt"))).toBe(true);
  });
});
