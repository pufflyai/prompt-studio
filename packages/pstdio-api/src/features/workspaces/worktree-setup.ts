import { existsSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { resolvePstdioWorkspacesPath } from "pstdio-paths";
import { createWorktree, resolveLatestBase } from "pstdio-wt";

export const resolveWorkspacesRoot = () => resolvePstdioWorkspacesPath({ env: process.env });

export const copyPstdioConfig = async (repoPath: string, worktreePath: string) => {
  const srcConfig = join(repoPath, ".pstdio", "config.json");
  const dstConfig = join(worktreePath, ".pstdio", "config.json");
  if (existsSync(srcConfig) && !existsSync(dstConfig)) {
    await mkdir(join(worktreePath, ".pstdio"), { recursive: true });
    await copyFile(srcConfig, dstConfig);
  }
};

// Creates the git worktree backing a workspace and returns its branch + path.
// Shared by ticketless workspace creation and the legacy ticket-attempt flow so
// both produce identical `workspace/<shorthand>` branches under the same root.
export const setupWorkspaceWorktree = async (input: { repoPath: string; workspaceShorthand: string; base: string }) => {
  const branch = `workspace/${input.workspaceShorthand}`;
  const worktreePath = join(resolveWorkspacesRoot(), input.workspaceShorthand);
  const base = await resolveLatestBase(input.repoPath, input.base);

  await createWorktree({ repoRoot: input.repoPath, branch, path: worktreePath, base });
  await copyPstdioConfig(input.repoPath, worktreePath);

  return { branch, worktreePath };
};
