import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getWorktreeDiffSummary, getWorktreeDiffSummaryFiles } from "./diff";
import { git } from "./git";
import { createTempRepo } from "./test-helpers";

let repo: Awaited<ReturnType<typeof createTempRepo>>;

beforeEach(async () => {
  repo = await createTempRepo();
});

afterEach(async () => {
  await repo.cleanup();
});

const addUnchangedSubtrees = async (root: string, count: number) => {
  for (let index = 0; index < count; index++) {
    const directory = join(root, `folder-${index}`, "nested");
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "file.txt"), "unchanged\n");
  }
  await git(root, ["add", "."]);
  await git(root, ["commit", "-m", "add unchanged subtrees"]);
};

test("current totals stay empty for a clean workspace with nested tracked files", async () => {
  await addUnchangedSubtrees(repo.dir, 4);
  expect(await getWorktreeDiffSummary({ worktreePath: repo.dir, base: "HEAD" })).toEqual({
    additions: 0,
    deletions: 0,
    file_count: 0,
  });
});

test("current totals preserve staged, unstaged, deleted, renamed and untracked changes", async () => {
  await writeFile(join(repo.dir, "removed.txt"), "gone\n");
  await writeFile(join(repo.dir, "rename-me.txt"), "rename\n");
  await git(repo.dir, ["add", "."]);
  await git(repo.dir, ["commit", "-m", "add tracked files"]);
  await writeFile(join(repo.dir, "README.md"), "staged\n");
  await git(repo.dir, ["add", "README.md"]);
  await writeFile(join(repo.dir, "README.md"), "staged\nunstaged\n");
  await rm(join(repo.dir, "removed.txt"));
  await git(repo.dir, ["mv", "rename-me.txt", "renamed.txt"]);
  await writeFile(join(repo.dir, "untracked.txt"), "one\ntwo\n");
  const expected = {
    additions: 4,
    deletions: 2,
    file_count: 4,
  };
  const options = { worktreePath: repo.dir, base: "HEAD" };
  expect((await getWorktreeDiffSummaryFiles(options)).totals).toEqual(expected);
  expect(await getWorktreeDiffSummary(options)).toEqual(expected);
});

test("current totals reflect working edits immediately while the index matches HEAD", async () => {
  const options = { worktreePath: repo.dir, base: "HEAD" };
  await writeFile(join(repo.dir, "README.md"), "working\nsecond\n");
  await writeFile(join(repo.dir, "untracked.txt"), "new\n");
  expect(await getWorktreeDiffSummary(options)).toEqual({ additions: 3, deletions: 1, file_count: 2 });
  await writeFile(join(repo.dir, "README.md"), "final\n");
  await rm(join(repo.dir, "untracked.txt"));
  expect(await getWorktreeDiffSummary(options)).toEqual({ additions: 1, deletions: 1, file_count: 1 });
});

test("current totals retain a staged deletion when that same path is untracked", async () => {
  await git(repo.dir, ["rm", "--cached", "README.md"]);
  const options = { worktreePath: repo.dir, base: "HEAD" };
  expect((await getWorktreeDiffSummaryFiles(options)).totals).toEqual({ additions: 1, deletions: 1, file_count: 1 });
  expect(await getWorktreeDiffSummary(options)).toEqual({ additions: 1, deletions: 1, file_count: 1 });
});

test("fork-point totals still read committed changes when the current index is clean", async () => {
  const base = await git(repo.dir, ["rev-parse", "HEAD"]);
  await writeFile(join(repo.dir, "README.md"), "committed\nreplacement\n");
  await git(repo.dir, ["add", "README.md"]);
  await git(repo.dir, ["commit", "-m", "change tracked content"]);
  await writeFile(join(repo.dir, "untracked.txt"), "untracked\n");
  expect(await getWorktreeDiffSummary({ worktreePath: repo.dir, base })).toEqual({
    additions: 3,
    deletions: 1,
    file_count: 2,
  });
});

test("fork-point totals count the final workspace instead of changes already reverted", async () => {
  const base = await git(repo.dir, ["rev-parse", "HEAD"]);
  const original = await Bun.file(join(repo.dir, "README.md")).text();
  await writeFile(join(repo.dir, "README.md"), "committed replacement\n");
  await git(repo.dir, ["add", "README.md"]);
  await git(repo.dir, ["commit", "-m", "replace tracked content"]);
  await writeFile(join(repo.dir, "README.md"), original);
  expect(await getWorktreeDiffSummary({ worktreePath: repo.dir, base })).toEqual({
    additions: 0,
    deletions: 0,
    file_count: 0,
  });
});

test("untracked filenames preserve spaces and Unicode when counting content", async () => {
  await writeFile(join(repo.dir, "é working file.txt"), "first\nsecond\n");
  expect(await getWorktreeDiffSummary({ worktreePath: repo.dir, base: "HEAD" })).toEqual({
    additions: 2,
    deletions: 0,
    file_count: 1,
  });
});

test.each(["staged modification", "staged addition"])("current totals omit a reverted %s", async (kind) => {
  if (kind === "staged modification") {
    const path = join(repo.dir, "README.md");
    const original = await Bun.file(path).text();
    await writeFile(path, "staged replacement\n");
    await git(repo.dir, ["add", "README.md"]);
    await writeFile(path, original);
  } else {
    const path = join(repo.dir, "added.txt");
    await writeFile(path, "staged addition\n");
    await git(repo.dir, ["add", "added.txt"]);
    await rm(path);
  }
  expect(await getWorktreeDiffSummary({ worktreePath: repo.dir, base: "HEAD" })).toEqual({
    additions: 0,
    deletions: 0,
    file_count: 0,
  });
});
