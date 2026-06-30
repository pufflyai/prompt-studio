import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolvePstdioWorkspacesPath } from "pstdio-paths";
import { createWorktree, resolveLatestBase } from "pstdio-wt";

export const resolveWorkspacesRoot = () => resolvePstdioWorkspacesPath({ env: process.env });

// Stamps the host workspace id into the worktree's config so CLI/extension commands
// run from inside the worktree resolve their workspace without a flag, while keeping
// every field copied from the project's source config.
export const copyPstdioConfig = async (repoPath: string, worktreePath: string, workspaceId: string) => {
  const srcConfig = join(repoPath, ".pstdio", "config.json");
  const dstConfig = join(worktreePath, ".pstdio", "config.json");
  if (existsSync(srcConfig) && !existsSync(dstConfig)) {
    const source = JSON.parse(await readFile(srcConfig, "utf8"));
    await mkdir(join(worktreePath, ".pstdio"), { recursive: true });
    await writeFile(dstConfig, `${JSON.stringify({ ...source, workspace_id: workspaceId }, null, 2)}\n`);
  }
};

// Creates the git worktree backing a workspace and returns its branch + path.
// Shared by ticketless workspace creation and the legacy ticket-attempt flow so
// both produce identical `workspace/<shorthand>` branches under the same root.
export const setupWorkspaceWorktree = async (input: {
  repoPath: string;
  workspaceShorthand: string;
  workspaceId: string;
  base: string;
}) => {
  const branch = `workspace/${input.workspaceShorthand}`;
  const worktreePath = join(resolveWorkspacesRoot(), input.workspaceShorthand);
  const base = await resolveLatestBase(input.repoPath, input.base);

  await createWorktree({ repoRoot: input.repoPath, branch, path: worktreePath, base });
  await copyPstdioConfig(input.repoPath, worktreePath, input.workspaceId);

  return { branch, worktreePath };
};
