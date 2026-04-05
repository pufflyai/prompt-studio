import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { join } from "node:path";
import { commitChanges } from "./commit";
import { git } from "./git";
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

describe("commitChanges", () => {
  test("stages all and commits", async () => {
    const wtPath = join(repo.dir, "wt-commit");
    await createWorktree({ repoRoot: repo.dir, branch: "task/commit", path: wtPath });

    await Bun.write(join(wtPath, "new-file.txt"), "content");

    const result = await commitChanges({
      worktreePath: wtPath,
      message: "add new file",
      stage: "all",
    });

    expect(result.sha).toHaveLength(40);
    expect(result.message).toBe("add new file");

    const log = await git(wtPath, ["log", "-1", "--format=%s"]);
    expect(log).toBe("add new file");
  });

  test("stages only tracked files", async () => {
    const wtPath = join(repo.dir, "wt-commit");
    await createWorktree({ repoRoot: repo.dir, branch: "task/tracked", path: wtPath });

    // modify tracked file
    await Bun.write(join(wtPath, "README.md"), "# updated\n");
    // create untracked file
    await Bun.write(join(wtPath, "untracked.txt"), "should not be staged");

    const result = await commitChanges({
      worktreePath: wtPath,
      message: "update tracked only",
      stage: "tracked",
    });

    expect(result.sha).toHaveLength(40);

    // untracked file should still be untracked
    const status = await git(wtPath, ["status", "--porcelain"]);
    expect(status).toContain("?? untracked.txt");
  });

  test("commits only pre-staged changes with stage=none", async () => {
    const wtPath = join(repo.dir, "wt-commit");
    await createWorktree({ repoRoot: repo.dir, branch: "task/none", path: wtPath });

    await Bun.write(join(wtPath, "staged.txt"), "staged");
    await Bun.write(join(wtPath, "unstaged.txt"), "unstaged");
    await git(wtPath, ["add", "staged.txt"]);

    const result = await commitChanges({
      worktreePath: wtPath,
      message: "staged only",
      stage: "none",
    });

    expect(result.sha).toHaveLength(40);

    const status = await git(wtPath, ["status", "--porcelain"]);
    expect(status).toContain("?? unstaged.txt");
    expect(status).not.toMatch(/^\?\? staged\.txt$/m);
    expect(status).not.toMatch(/^A\s+staged\.txt$/m);
  });

  test("pre-commit hook aborts commit on failure", async () => {
    const wtPath = join(repo.dir, "wt-commit");
    await createWorktree({ repoRoot: repo.dir, branch: "task/hook-fail", path: wtPath });

    const dispatch: HookDispatch = {
      firePreHook: mock(() => Promise.resolve({ rejected: true, reason: "lint failed" })),
      firePostHook: mock(() => Promise.resolve()),
    };

    await Bun.write(join(wtPath, "file.txt"), "content");

    await expect(
      commitChanges({ worktreePath: wtPath, message: "should fail", repoPath: repo.dir, dispatch }),
    ).rejects.toThrow("HOOK preCommit FAILED");
  });

  test("post-commit hook runs after successful commit", async () => {
    const wtPath = join(repo.dir, "wt-commit");
    await createWorktree({ repoRoot: repo.dir, branch: "task/hook-post", path: wtPath });

    const dispatch = noopDispatch();

    await Bun.write(join(wtPath, "file.txt"), "content");

    await commitChanges({ worktreePath: wtPath, message: "with hook", repoPath: repo.dir, dispatch });

    expect(dispatch.firePostHook).toHaveBeenCalledWith(
      "postCommit",
      expect.objectContaining({
        repoPath: repo.dir,
        worktreePath: wtPath,
        commitMessage: "with hook",
      }),
    );
  });

  test("dispatch ctx contains expected fields", async () => {
    const wtPath = join(repo.dir, "wt-commit");
    await createWorktree({ repoRoot: repo.dir, branch: "task/payload", path: wtPath });

    const dispatch = noopDispatch();

    await Bun.write(join(wtPath, "payload.txt"), "payload");
    await commitChanges({
      worktreePath: wtPath,
      message: "payload commit",
      repoPath: repo.dir,
      stage: "all",
      dispatch,
    });

    expect(dispatch.firePreHook).toHaveBeenCalledWith("preCommit", {
      repoPath: repo.dir,
      worktreePath: wtPath,
      commitMessage: "payload commit",
      stagePolicy: "all",
    });

    expect(dispatch.firePostHook).toHaveBeenCalledWith(
      "postCommit",
      expect.objectContaining({
        repoPath: repo.dir,
        worktreePath: wtPath,
        commitMessage: "payload commit",
        stagePolicy: "all",
        commitSha: expect.stringMatching(/^[0-9a-f]{40}$/),
      }),
    );
  });
});
