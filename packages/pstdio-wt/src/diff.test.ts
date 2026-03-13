import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { getDiffAgainstDirectory, getWorktreeDiff } from "./diff";
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

describe("getDiffAgainstDirectory", () => {
  test("returns empty diff when directories are identical", async () => {
    const wtPath = join(repo.dir, "wt-dir-clean");
    await createWorktree({ repoRoot: repo.dir, branch: "task/dir-clean", path: wtPath });

    const diff = await getDiffAgainstDirectory({
      worktreePath: wtPath,
      referencePath: repo.dir,
    });

    expect(diff.files).toEqual([]);
    expect(diff.totals.file_count).toBe(0);
  });

  test("detects file added in worktree but not in reference", async () => {
    const wtPath = join(repo.dir, "wt-dir-add");
    await createWorktree({ repoRoot: repo.dir, branch: "task/dir-add", path: wtPath });

    await Bun.write(join(wtPath, "new-file.txt"), "hello\n");
    await git(wtPath, ["add", "."]);
    await git(wtPath, ["commit", "-m", "add file"]);

    const diff = await getDiffAgainstDirectory({
      worktreePath: wtPath,
      referencePath: repo.dir,
    });

    expect(diff.files.length).toBe(1);
    expect(diff.files[0].filePath).toBe("new-file.txt");
    expect(diff.files[0].change).toBe("added");
    expect(diff.files[0].newContent).toBe("hello\n");
  });

  test("detects file modified relative to reference", async () => {
    const wtPath = join(repo.dir, "wt-dir-mod");
    await createWorktree({ repoRoot: repo.dir, branch: "task/dir-mod", path: wtPath });

    await Bun.write(join(wtPath, "README.md"), "# changed\n");
    await git(wtPath, ["add", "."]);
    await git(wtPath, ["commit", "-m", "modify readme"]);

    const diff = await getDiffAgainstDirectory({
      worktreePath: wtPath,
      referencePath: repo.dir,
    });

    expect(diff.files.length).toBe(1);
    expect(diff.files[0].filePath).toBe("README.md");
    expect(diff.files[0].change).toBe("modified");
    expect(diff.files[0].oldContent).toBe("# test repo\n");
    expect(diff.files[0].newContent).toBe("# changed\n");
  });

  test("detects file deleted in worktree but present in reference", async () => {
    const wtPath = join(repo.dir, "wt-dir-del");
    await createWorktree({ repoRoot: repo.dir, branch: "task/dir-del", path: wtPath });

    await git(wtPath, ["rm", "README.md"]);
    await git(wtPath, ["commit", "-m", "delete readme"]);

    const diff = await getDiffAgainstDirectory({
      worktreePath: wtPath,
      referencePath: repo.dir,
    });

    expect(diff.files.length).toBe(1);
    expect(diff.files[0].filePath).toBe("README.md");
    expect(diff.files[0].change).toBe("deleted");
    expect(diff.files[0].oldContent).toBe("# test repo\n");
    expect(diff.files[0].newContent).toBe("");
  });

  test("picks up dirty (uncommitted) changes in reference directory", async () => {
    const wtPath = join(repo.dir, "wt-dir-dirty-ref");
    await createWorktree({ repoRoot: repo.dir, branch: "task/dir-dirty-ref", path: wtPath });

    // Modify the main repo (dirty state) without committing
    await Bun.write(join(repo.dir, "README.md"), "# dirty main\n");

    // Worktree still has original content — diff should show the difference
    const diff = await getDiffAgainstDirectory({
      worktreePath: wtPath,
      referencePath: repo.dir,
    });

    expect(diff.files.length).toBe(1);
    expect(diff.files[0].filePath).toBe("README.md");
    expect(diff.files[0].change).toBe("modified");
    // oldContent = reference (dirty main), newContent = worktree
    expect(diff.files[0].oldContent).toBe("# dirty main\n");
    expect(diff.files[0].newContent).toBe("# test repo\n");
  });

  test("includes uncommitted files in worktree", async () => {
    const wtPath = join(repo.dir, "wt-dir-dirty-wt");
    await createWorktree({ repoRoot: repo.dir, branch: "task/dir-dirty-wt", path: wtPath });

    // Add an uncommitted file to the worktree
    await Bun.write(join(wtPath, "wip.txt"), "work in progress\n");

    const diff = await getDiffAgainstDirectory({
      worktreePath: wtPath,
      referencePath: repo.dir,
    });

    const filePaths = diff.files.map((f) => f.filePath);
    expect(filePaths).toContain("wip.txt");
  });
});
