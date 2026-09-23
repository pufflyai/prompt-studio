import { realpath, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { resolvePstdioWorkspacesPath } from "pstdio-paths";
import { createWorktree, git, removeWorktreeAndBranch, resolveLatestBase } from "pstdio-wt";

export const resolveWorkspacesRoot = () => resolvePstdioWorkspacesPath({ env: process.env });

export const setupWorkspaceWorktree = async (input: {
  repoPath: string;
  workspaceId: string;
  workspaceShorthand: string;
  base: string;
}) => {
  const projectPath = await realpath(input.repoPath);
  const sourceRoot = await realpath(await git(projectPath, ["rev-parse", "--show-toplevel"]));
  const relativePath = relative(sourceRoot, projectPath);
  const branch = `workspace/${input.workspaceShorthand}-${input.workspaceId}`;
  const worktreePath = join(resolveWorkspacesRoot(), input.workspaceId);
  const base = await resolveLatestBase(sourceRoot, input.base);
  try {
    await git(sourceRoot, ["rev-parse", "--verify", `${base}^{commit}`]);
  } catch {
    throw new Error(`Git isolation requires a usable base commit: ${input.base}.`);
  }
  await createWorktree({ repoRoot: sourceRoot, branch, path: worktreePath, base });
  const rootPath = join(worktreePath, relativePath);
  try {
    if (!(await stat(rootPath)).isDirectory()) throw new Error("Project folder is not a directory.");
  } catch {
    await removeWorktreeAndBranch({ repoRoot: sourceRoot, path: worktreePath, branch, force: true });
    throw new Error(`The project folder does not exist at revision ${input.base}.`);
  }
  return { branch, worktreePath, rootPath, sourceRoot, relativePath };
};

export const hasUsableGitBase = async (path: string) => {
  try {
    await git(path, ["rev-parse", "--verify", "HEAD^{commit}"]);
    return true;
  } catch {
    return false;
  }
};
