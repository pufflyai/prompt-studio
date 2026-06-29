import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolvePstdioWorkspacesPath } from "pstdio-paths";
import { createWorktree, resolveLatestBase } from "pstdio-wt";

export const resolveWorkspacesRoot = () => resolvePstdioWorkspacesPath({ env: process.env });

const readJsonObject = (path: string) => {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
};

// Writes the worktree's `.pstdio/config.json` so commands run inside the worktree
// can resolve the host workspace. Preserves any other fields the project config carries.
export const writeWorkspaceWorktreeConfig = async (input: {
  repoPath: string;
  worktreePath: string;
  workspaceId?: string;
}) => {
  const srcConfig = join(input.repoPath, ".pstdio", "config.json");
  const dstConfigDir = join(input.worktreePath, ".pstdio");
  const dstConfig = join(dstConfigDir, "config.json");

  const base = existsSync(srcConfig) ? readJsonObject(srcConfig) : {};
  if (!input.workspaceId && Object.keys(base).length === 0) return;

  const merged = input.workspaceId ? { ...base, workspace_id: input.workspaceId } : base;
  await mkdir(dstConfigDir, { recursive: true });
  await writeFile(dstConfig, `${JSON.stringify(merged, null, 2)}\n`);
};

// Creates the git worktree backing a workspace and returns its branch + path.
// Shared by ticketless workspace creation and the legacy ticket-attempt flow so
// both produce identical `workspace/<shorthand>` branches under the same root.
export const setupWorkspaceWorktree = async (input: {
  repoPath: string;
  workspaceShorthand: string;
  base: string;
  workspaceId?: string;
}) => {
  const branch = `workspace/${input.workspaceShorthand}`;
  const worktreePath = join(resolveWorkspacesRoot(), input.workspaceShorthand);
  const base = await resolveLatestBase(input.repoPath, input.base);

  await createWorktree({ repoRoot: input.repoPath, branch, path: worktreePath, base });
  await writeWorkspaceWorktreeConfig({
    repoPath: input.repoPath,
    worktreePath,
    workspaceId: input.workspaceId,
  });

  return { branch, worktreePath };
};
