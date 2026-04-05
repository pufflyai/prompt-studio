import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { PluginHelperContext } from "./context";
import { pullTickets } from "./ticket-pull";

const AGENT_DIRS = [".claude", ".opencode", ".agents"];

type BootstrapWorktreeInput = {
  repoPath: string;
  worktreePath: string;
  ticketId?: string;
};

export const bootstrapWorktree = async (ctx: PluginHelperContext, input: BootstrapWorktreeInput) => {
  const { repoPath, worktreePath, ticketId } = input;

  const repoConfig = join(repoPath, ".pstdio", "config.json");
  const worktreeConfigDir = join(worktreePath, ".pstdio");
  const worktreeConfig = join(worktreeConfigDir, "config.json");

  if (existsSync(repoConfig)) {
    mkdirSync(worktreeConfigDir, { recursive: true });
    cpSync(repoConfig, worktreeConfig);
  }

  for (const agentDir of AGENT_DIRS) {
    const fromDir = join(repoPath, agentDir);
    const toDir = join(worktreePath, agentDir);
    if (!existsSync(fromDir)) continue;
    mkdirSync(toDir, { recursive: true });
    cpSync(fromDir, toDir, { recursive: true });
  }

  if (!ticketId) return;
  await pullTickets(ctx, { rootPath: worktreePath, ticketId });
};
