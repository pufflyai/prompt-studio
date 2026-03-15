import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { getWorktreeDiff } from "./diff";
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

describe("getWorktreeDiff", () => {
  test("returns empty diff for clean worktree", async () => {
    const wtPath = join(repo.dir, "wt-diff-clean");
    await createWorktree({ repoRoot: repo.dir, branch: "task/clean", path: wtPath });

    const diff = await getWorktreeDiff({ worktreePath: wtPath, base: "main" });

    expect(diff.files).toEqual([]);
    expect(diff.totals.additions).toBe(0);
    expect(diff.totals.deletions).toBe(0);
    expect(diff.totals.file_count).toBe(0);
  });

  test("detects added file in committed changes", async () => {
    const wtPath = join(repo.dir, "wt-diff-add");
    await createWorktree({ repoRoot: repo.dir, branch: "task/add", path: wtPath });

    await Bun.write(join(wtPath, "new-file.txt"), "hello world\n");
    await git(wtPath, ["add", "."]);
    await git(wtPath, ["commit", "-m", "add file"]);

    const diff = await getWorktreeDiff({ worktreePath: wtPath, base: "main" });

    expect(diff.files.length).toBe(1);
    expect(diff.files[0].filePath).toBe("new-file.txt");
    expect(diff.files[0].change).toBe("added");
    expect(diff.files[0].additions).toBe(1);
    expect(diff.files[0].deletions).toBe(0);
    expect(diff.files[0].newContent).toBe("hello world\n");
    expect(diff.totals.file_count).toBe(1);
  });

  test("detects modified file", async () => {
    const wtPath = join(repo.dir, "wt-diff-mod");
    await createWorktree({ repoRoot: repo.dir, branch: "task/modify", path: wtPath });

    await Bun.write(join(wtPath, "README.md"), "# updated repo\n");
    await git(wtPath, ["add", "."]);
    await git(wtPath, ["commit", "-m", "update readme"]);

    const diff = await getWorktreeDiff({ worktreePath: wtPath, base: "main" });

    expect(diff.files.length).toBe(1);
    expect(diff.files[0].filePath).toBe("README.md");
    expect(diff.files[0].change).toBe("modified");
    expect(diff.files[0].oldContent).toBe("# test repo\n");
    expect(diff.files[0].newContent).toBe("# updated repo\n");
  });

  test("detects deleted file", async () => {
    const wtPath = join(repo.dir, "wt-diff-del");
    await createWorktree({ repoRoot: repo.dir, branch: "task/delete", path: wtPath });

    await git(wtPath, ["rm", "README.md"]);
    await git(wtPath, ["commit", "-m", "delete readme"]);

    const diff = await getWorktreeDiff({ worktreePath: wtPath, base: "main" });

    expect(diff.files.length).toBe(1);
    expect(diff.files[0].filePath).toBe("README.md");
    expect(diff.files[0].change).toBe("deleted");
    expect(diff.files[0].oldContent).toBe("# test repo\n");
    expect(diff.files[0].newContent).toBe("");
  });

  test("includes uncommitted staged and unstaged changes", async () => {
    const wtPath = join(repo.dir, "wt-diff-dirty");
    await createWorktree({ repoRoot: repo.dir, branch: "task/dirty", path: wtPath });

    await Bun.write(join(wtPath, "staged.txt"), "staged\n");
    await git(wtPath, ["add", "staged.txt"]);
    await Bun.write(join(wtPath, "unstaged.txt"), "unstaged\n");

    const diff = await getWorktreeDiff({ worktreePath: wtPath, base: "main" });

    const filePaths = diff.files.map((f) => f.filePath).sort();
    expect(filePaths).toContain("staged.txt");
    expect(filePaths).toContain("unstaged.txt");
  });

  test("counts additions for untracked files", async () => {
    const wtPath = join(repo.dir, "wt-diff-untracked");
    await createWorktree({ repoRoot: repo.dir, branch: "task/untracked", path: wtPath });

    await Bun.write(join(wtPath, "new-file.txt"), "first line\nsecond line\n");

    const diff = await getWorktreeDiff({ worktreePath: wtPath, base: "main" });

    expect(diff.files.length).toBe(1);
    expect(diff.files[0].filePath).toBe("new-file.txt");
    expect(diff.files[0].change).toBe("added");
    expect(diff.files[0].additions).toBe(2);
    expect(diff.files[0].deletions).toBe(0);
    expect(diff.totals.additions).toBe(2);
    expect(diff.totals.deletions).toBe(0);
  });

  test("detects renamed file", async () => {
    const wtPath = join(repo.dir, "wt-diff-rename");
    await createWorktree({ repoRoot: repo.dir, branch: "task/rename", path: wtPath });

    await git(wtPath, ["mv", "README.md", "DOCS.md"]);
    await git(wtPath, ["commit", "-m", "rename readme"]);

    const diff = await getWorktreeDiff({ worktreePath: wtPath, base: "main" });

    expect(diff.files.length).toBe(1);
    expect(diff.files[0].change).toBe("renamed");
    expect(diff.files[0].oldPath).toBe("README.md");
    expect(diff.files[0].newPath).toBe("DOCS.md");
  });
});

describe("getWorktreeDiff with base=HEAD (current mode)", () => {
  test("returns empty diff when no uncommitted changes", async () => {
    const wtPath = join(repo.dir, "wt-current-clean");
    await createWorktree({ repoRoot: repo.dir, branch: "task/current-clean", path: wtPath });

    // Commit a change — should NOT appear in HEAD diff
    await Bun.write(join(wtPath, "committed.txt"), "committed\n");
    await git(wtPath, ["add", "."]);
    await git(wtPath, ["commit", "-m", "add file"]);

    const diff = await getWorktreeDiff({ worktreePath: wtPath, base: "HEAD" });

    expect(diff.files).toEqual([]);
    expect(diff.totals.file_count).toBe(0);
  });

  test("shows only uncommitted changes, not committed ones", async () => {
    const wtPath = join(repo.dir, "wt-current-dirty");
    await createWorktree({ repoRoot: repo.dir, branch: "task/current-dirty", path: wtPath });

    // Commit a change
    await Bun.write(join(wtPath, "committed.txt"), "committed\n");
    await git(wtPath, ["add", "."]);
    await git(wtPath, ["commit", "-m", "add file"]);

    // Add uncommitted changes
    await Bun.write(join(wtPath, "dirty.txt"), "dirty\n");

    const diff = await getWorktreeDiff({ worktreePath: wtPath, base: "HEAD" });

    expect(diff.files.length).toBe(1);
    expect(diff.files[0].filePath).toBe("dirty.txt");
    expect(diff.files[0].change).toBe("added");
  });
});
