import { join } from "node:path";
import { GitError, git } from "./git";
import type { WorktreeInfo } from "./types";

type ListEntry = {
  worktree: string;
  branch: string;
  HEAD: string;
  bare: boolean;
  prunable: boolean;
};

export const listWorktrees = async (repoRoot: string) => {
  const output = await git(repoRoot, ["worktree", "list", "--porcelain"]);
  const entries: ListEntry[] = [];
  let current: Partial<ListEntry> = {};

  for (const line of output.split("\n")) {
    if (line.startsWith("worktree ")) {
      current = { worktree: line.slice("worktree ".length) };
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

export const createWorktree = async (opts: {
  repoRoot: string;
  branch: string;
  path: string;
  base?: string;
}): Promise<WorktreeInfo> => {
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

  try {
    await git(opts.repoRoot, ["worktree", "add", "-b", opts.branch, opts.path, base]);
  } catch (err) {
    // branch exists but no worktree — stale leftover from a previous cleanup
    if (err instanceof GitError && err.stderr.includes("already exists")) {
      await git(opts.repoRoot, ["worktree", "prune"]);
      await git(opts.repoRoot, ["branch", "-D", opts.branch]);
      await git(opts.repoRoot, ["worktree", "add", "-b", opts.branch, opts.path, base]);
    } else {
      throw err;
    }
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
  return join(baseDir, safeName);
};
