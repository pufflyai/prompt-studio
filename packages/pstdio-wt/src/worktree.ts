import { existsSync } from "node:fs";
import { posix, win32 } from "node:path";
import { git } from "./git";
import type { WorktreeInfo } from "./types";

type ListEntry = {
  worktree: string;
  branch: string;
  HEAD: string;
  bare: boolean;
  prunable: boolean;
};

const normalizeGitPath = (path: string) => (process.platform === "win32" ? win32.normalize(path) : path);

const isWindowsPath = (path: string) => path.includes("\\") || /^[A-Za-z]:[\\/]/.test(path);

export const listWorktrees = async (repoRoot: string) => {
  const output = await git(repoRoot, ["worktree", "list", "--porcelain"]);
  const entries: ListEntry[] = [];
  let current: Partial<ListEntry> = {};

  for (const line of output.split("\n")) {
    if (line.startsWith("worktree ")) {
      current = { worktree: normalizeGitPath(line.slice("worktree ".length)) };
    } else if (line.startsWith("HEAD ")) {
      current.HEAD = line.slice("HEAD ".length);
    } else if (line.startsWith("branch ")) {
      current.branch = line.slice("branch ".length).replace("refs/heads/", "");
    } else if (line === "bare") {
      current.bare = true;
    } else if (line.startsWith("prunable ")) {
      current.prunable = true;
    } else if (line === "" && current.worktree) {
      entries.push(current as ListEntry);
      current = {};
    }
  }

  if (current.worktree) {
    entries.push(current as ListEntry);
  }

  return entries.filter((e) => !e.prunable);
};

export const findWorktreeByBranch = async (repoRoot: string, branch: string) => {
  const entries = await listWorktrees(repoRoot);
  return entries.find((e) => e.branch === branch) ?? null;
};

type WorktreeInput = {
  repoRoot: string;
  branch: string;
  path: string;
  base?: string;
};

export class WorkspaceCollisionError extends Error {}

export const createWorktree = async (opts: WorktreeInput) => {
  if (existsSync(opts.path)) throw new WorkspaceCollisionError(`Workspace directory is occupied: ${opts.path}`);
  if (await branchExists(opts.repoRoot, opts.branch))
    throw new WorkspaceCollisionError(`Workspace branch already exists: ${opts.branch}`);
  const base = opts.base ?? "HEAD";
  await git(opts.repoRoot, ["worktree", "add", "-b", opts.branch, opts.path, base]);
  return { branch: opts.branch, path: opts.path, base, created: true } satisfies WorktreeInfo;
};

// Restoration is only for a branch already recorded as owned by the workspace.
export const restoreWorktree = async (opts: WorktreeInput) => {
  const base = opts.base ?? "HEAD";

  // check if worktree already exists for this branch
  const existing = await findWorktreeByBranch(opts.repoRoot, opts.branch);
  if (existing) {
    return {
      branch: opts.branch,
      path: existing.worktree,
      base,
      created: false,
    };
  }

  if (existsSync(opts.path)) throw new WorkspaceCollisionError(`Workspace directory is occupied: ${opts.path}`);
  await git(opts.repoRoot, ["worktree", "prune"]);
  if (await branchExists(opts.repoRoot, opts.branch)) {
    await git(opts.repoRoot, ["worktree", "add", opts.path, opts.branch]);
  } else {
    await git(opts.repoRoot, ["worktree", "add", "-b", opts.branch, opts.path, base]);
  }

  return {
    branch: opts.branch,
    path: opts.path,
    base,
    created: true,
  };
};

export const removeWorktree = async (opts: { repoRoot: string; path: string; force?: boolean }) => {
  if (!opts.force) {
    const status = await git(opts.path, ["status", "--porcelain"]);
    if (status !== "") {
      throw new Error(`Worktree at ${opts.path} has uncommitted changes. Use force: true to remove anyway.`);
    }
  }

  const args = ["worktree", "remove", opts.path];
  if (opts.force) args.push("--force");
  await git(opts.repoRoot, args);
};

export const removeWorktreeAndBranch = async (opts: {
  repoRoot: string;
  path: string;
  branch: string;
  force?: boolean;
}) => {
  await removeWorktree({ repoRoot: opts.repoRoot, path: opts.path, force: opts.force });
  try {
    await git(opts.repoRoot, ["branch", "-D", opts.branch]);
  } catch {
    // branch may already be gone
  }
};

export const branchExists = async (repoRoot: string, branch: string) => {
  try {
    await git(repoRoot, ["rev-parse", "--verify", `refs/heads/${branch}`]);
    return true;
  } catch {
    return false;
  }
};

export const worktreePath = (baseDir: string, branch: string) => {
  const safeName = branch.replace(/[^a-zA-Z0-9_-]/g, "_");
  const pathApi = isWindowsPath(baseDir) || (process.platform === "win32" && !baseDir.startsWith("/")) ? win32 : posix;
  return pathApi.join(baseDir, safeName);
};
