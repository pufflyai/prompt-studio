import { join } from "node:path";
import { resolvePstdioWorkspacesPath } from "pstdio-paths";
import { createWorktree, git, resolveLatestBase } from "pstdio-wt";
import { assertWorkspaceShorthand } from "./workspace-shorthand";

export const resolveWorkspacesRoot = () => resolvePstdioWorkspacesPath({ env: process.env });

export const hasUsableGitBase = async (path: string) => {
  try {
    await git(path, ["rev-parse", "--verify", "HEAD^{commit}"]);
    return true;
  } catch {
    return false;
  }
};

// Creates the git worktree backing a workspace and returns its branch + path. Shared by
// workspace creation and extension-managed workflows so both produce
// identical `workspace/<shorthand>` branches under the same root. The worktree's
// `.pstdio/config.json` (incl. the workspace id) is materialized later by the provision
// lifecycle, uniformly for every workspace type.
export const setupWorkspaceWorktree = async (input: { repoPath: string; workspaceShorthand: string; base: string }) => {
  assertWorkspaceShorthand(input.workspaceShorthand);
  const branch = `workspace/${input.workspaceShorthand}`;
  const worktreePath = join(resolveWorkspacesRoot(), input.workspaceShorthand);
  const base = await resolveLatestBase(input.repoPath, input.base);

  await createWorktree({ repoRoot: input.repoPath, branch, path: worktreePath, base });

  return { branch, worktreePath };
};
