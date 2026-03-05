import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

const git = async (repoRoot: string, args: string) => {
  const { stdout } = await execAsync(`git ${args}`, { cwd: repoRoot });
  return stdout.trim();
};

export const createGitWorktreeService = () => {
  const createWorktree = async (repoRoot: string, path: string, branch: string, baseRef: string) => {
    await git(repoRoot, `worktree add -b ${branch} ${path} ${baseRef}`);
  };

  const removeWorktree = async (repoRoot: string, path: string) => {
    await git(repoRoot, `worktree remove --force ${path}`);
  };

  const deleteBranch = async (repoRoot: string, branch: string) => {
    await git(repoRoot, `branch -D ${branch}`);
  };

  const isCleanWorkingTree = async (repoRoot: string) => {
    const output = await git(repoRoot, "status --porcelain");
    return output === "";
  };

  const getCurrentBranchOrCommit = async (repoRoot: string) => {
    try {
      return await git(repoRoot, "symbolic-ref --short HEAD");
    } catch {
      return await git(repoRoot, "rev-parse HEAD");
    }
  };

  const getCommitHash = async (repoRoot: string, ref: string) => {
    return await git(repoRoot, `rev-parse ${ref}`);
  };

  const checkoutBranch = async (repoRoot: string, branch: string, ref?: string) => {
    if (ref) {
      await git(repoRoot, `checkout -b ${branch} ${ref}`);
    } else {
      await git(repoRoot, `checkout ${branch}`);
    }
  };

  const squashMerge = async (repoRoot: string, branch: string, message: string) => {
    await git(repoRoot, `merge --squash ${branch}`);
    await git(repoRoot, `commit -m "${message}"`);
  };

  const abortMerge = async (repoRoot: string) => {
    await git(repoRoot, "reset --merge");
  };

  const refExists = async (repoRoot: string, ref: string) => {
    try {
      await git(repoRoot, `rev-parse --verify ${ref}`);
      return true;
    } catch {
      return false;
    }
  };

  return {
    createWorktree,
    removeWorktree,
    deleteBranch,
    isCleanWorkingTree,
    getCurrentBranchOrCommit,
    getCommitHash,
    checkoutBranch,
    squashMerge,
    abortMerge,
    refExists,
  };
};

export type GitWorktreeService = ReturnType<typeof createGitWorktreeService>;
