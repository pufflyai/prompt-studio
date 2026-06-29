import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionWorktreesApi } from "pstdio-api-contracts/extension-kernel";
import { writeWorkspaceWorktreeConfig } from "../workspaces/worktree-setup";
import type { ExtensionsRouteDeps } from "./deps";

type WorktreeEnvironmentDeps = Pick<ExtensionsRouteDeps, "workspaceService">;

const AGENT_DIRS = [".claude", ".opencode", ".agents"];

const bootstrapWorktree = async (input: { repoPath: string; worktreePath: string; workspaceId?: string }) => {
  await writeWorkspaceWorktreeConfig({
    repoPath: input.repoPath,
    worktreePath: input.worktreePath,
    workspaceId: input.workspaceId,
  });

  for (const agentDir of AGENT_DIRS) {
    const fromDir = join(input.repoPath, agentDir);
    if (!existsSync(fromDir)) continue;
    cpSync(fromDir, join(input.worktreePath, agentDir), { recursive: true });
  }
};

export const createExtensionWorktreesApi = (
  _deps: WorktreeEnvironmentDeps,
  _input: { projectId: string },
): ExtensionWorktreesApi => {
  return {
    bootstrap: (worktreeInput) => bootstrapWorktree(worktreeInput),
  };
};
