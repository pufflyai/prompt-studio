import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { commitChanges } from "./commit";
import { git } from "./git";
import { createTempRepo } from "./test-helpers";
import { createWorktree } from "./worktree";

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
});
