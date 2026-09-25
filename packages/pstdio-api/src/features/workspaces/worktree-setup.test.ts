import { afterEach, beforeEach, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getWorktreeDiff, git } from "pstdio-wt";
import { cleanupWorkspaceWorktree } from "./worktree-cleanup";
import { resolveWorkspacesRoot, setupWorkspaceWorktree } from "./worktree-setup";

let root: string;
let repo: string;
let oldHome: string | undefined;
beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), "folder-worktree-")));
  repo = join(root, "repo");
  await mkdir(repo);
  oldHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(root, "home");
  await git(repo, ["init", "-b", "main"]);
  await git(repo, ["config", "user.name", "Test"]);
  await git(repo, ["config", "user.email", "test@example.com"]);
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  if (oldHome === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = oldHome;
});
const commit = async () => {
  await git(repo, ["add", "."]);
  await git(repo, ["commit", "-m", "Base"]);
};

test("isolates a Git subfolder while retaining whole-repository changes for review", async () => {
  const folder = join(repo, "packages", "研究");
  await mkdir(folder, { recursive: true });
  await writeFile(join(folder, "notes.txt"), "before\n");
  await writeFile(join(repo, "outside.txt"), "before\n");
  await commit();
  await symlink(folder, join(root, "alias"));
  const result = await setupWorkspaceWorktree({
    repoPath: join(root, "alias"),
    workspaceId: "one",
    workspaceShorthand: "WS-1",
    base: "HEAD",
  });
  expect(result.rootPath).toBe(join(result.worktreePath, "packages", "研究"));
  await writeFile(join(result.worktreePath, "outside.txt"), "after\n");
  const diff = await getWorktreeDiff({ worktreePath: result.worktreePath, base: "HEAD" });
  expect(diff.files.map((file) => file.filePath)).toContain("outside.txt");
  expect(
    await cleanupWorkspaceWorktree({} as never, {
      provider_id: "pstdio.worktree",
      branch: result.branch,
      provider_ref_json: { data: { sourceRoot: result.sourceRoot, worktreeRoot: result.worktreePath } },
    }),
  ).toBe(true);
  expect(existsSync(folder)).toBe(true);
  expect(existsSync(result.worktreePath)).toBe(false);
});

test("removes a new worktree and branch if the project subfolder is absent at the base", async () => {
  await writeFile(join(repo, "base.txt"), "base");
  await commit();
  const base = await git(repo, ["rev-parse", "HEAD"]);
  const folder = join(repo, "new-package");
  await mkdir(folder);
  await writeFile(join(folder, "file.txt"), "new");
  await commit();
  await expect(
    setupWorkspaceWorktree({ repoPath: folder, workspaceId: "two", workspaceShorthand: "WS-2", base }),
  ).rejects.toThrow("project folder does not exist");
  expect(existsSync(join(resolveWorkspacesRoot(), "two"))).toBe(false);
  expect(await git(repo, ["branch", "--list", "workspace/WS-2-two"])).toBe("");
});

test("requires a usable commit before allocating isolation", async () => {
  await expect(
    setupWorkspaceWorktree({ repoPath: repo, workspaceId: "three", workspaceShorthand: "WS-3", base: "HEAD" }),
  ).rejects.toThrow();
  expect(existsSync(join(resolveWorkspacesRoot(), "three"))).toBe(false);
});

test("rejects a base revision whose project subfolder is a symlink outside the new worktree", async () => {
  const workspaceId = "escape";
  const outside = join(resolveWorkspacesRoot(), `${workspaceId}-outside`);
  await mkdir(outside, { recursive: true });
  await writeFile(join(outside, "notes.txt"), "Preserve these notes.");
  await git(repo, ["config", "core.symlinks", "true"]);
  const folder = join(repo, "docs");
  await symlink(outside, folder, "dir");
  await commit();
  const base = await git(repo, ["rev-parse", "HEAD"]);
  await rm(folder);
  await mkdir(folder);
  await writeFile(join(folder, "notes.txt"), "Project notes.");
  await commit();

  await expect(
    setupWorkspaceWorktree({ repoPath: folder, workspaceId, workspaceShorthand: "WS-4", base }),
  ).rejects.toThrow("outside the new worktree");
  expect(existsSync(join(resolveWorkspacesRoot(), workspaceId))).toBe(false);
  expect(await git(repo, ["branch", "--list", "workspace/WS-4-escape"])).toBe("");
  expect(await readFile(join(outside, "notes.txt"), "utf8")).toBe("Preserve these notes.");
  expect(existsSync(join(outside, ".pstdio"))).toBe(false);
});

test("workspaces with the same shorthand have independent Git resources", async () => {
  await writeFile(join(repo, "notes.txt"), "base");
  await commit();
  const first = await setupWorkspaceWorktree({
    repoPath: repo,
    workspaceId: "workspace-one",
    workspaceShorthand: "WS-1",
    base: "HEAD",
  });
  const second = await setupWorkspaceWorktree({
    repoPath: repo,
    workspaceId: "workspace-two",
    workspaceShorthand: "WS-1",
    base: "HEAD",
  });
  expect(first.worktreePath).not.toBe(second.worktreePath);
  expect(first.branch).not.toBe(second.branch);
  expect(existsSync(join(first.rootPath, "notes.txt"))).toBe(true);
  expect(existsSync(join(second.rootPath, "notes.txt"))).toBe(true);
});
