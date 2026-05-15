import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

type WorktreeCreatePayload = {
  repoPath: string;
  worktreePath: string;
  ticket?: string;
};

type TicketArchivePayload = {
  id: string;
  shorthand: string;
  workspaces?: WorkspaceRecord[];
};

type WorkspaceRecord = {
  id: string;
  ticket_shorthand?: string | null;
  workspace_shorthand?: string | null;
  worktree_path?: string | null;
};

type ProcessApi = {
  run(input: { command: string[]; cwd?: string }): Promise<{ exitCode: number; stdout: string; stderr: string }>;
};

const agentDirs = [".claude", ".opencode", ".agents"];
const ignoredExtensionCopyEntries = new Set(["node_modules", ".git", ".cache"]);

const shouldCopyExtensionEntry = (source: string) => {
  const parts = source.split(/[\\/]/);
  return !parts.some((part) => ignoredExtensionCopyEntries.has(part));
};

const copyProjectFiles = (repoPath: string, worktreePath: string) => {
  const repoConfig = join(repoPath, ".pstdio", "config.json");
  const worktreeConfigDir = join(worktreePath, ".pstdio");
  if (existsSync(repoConfig)) {
    mkdirSync(worktreeConfigDir, { recursive: true });
    cpSync(repoConfig, join(worktreeConfigDir, "config.json"));
  }

  const repoExtensions = join(repoPath, ".pstdio", "extensions");
  if (existsSync(repoExtensions)) {
    mkdirSync(worktreeConfigDir, { recursive: true });
    cpSync(repoExtensions, join(worktreeConfigDir, "extensions"), {
      filter: shouldCopyExtensionEntry,
      recursive: true,
    });
  }

  for (const dir of agentDirs) {
    const from = join(repoPath, dir);
    if (!existsSync(from)) continue;
    const to = join(worktreePath, dir);
    mkdirSync(to, { recursive: true });
    cpSync(from, to, { recursive: true });
  }
};

const assertCommand = async (process: ProcessApi, cwd: string, command: string[]) => {
  const result = await process.run({ cwd, command });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || `${command.join(" ")} failed with exit ${result.exitCode}`);
  }
};

const isTicketWorkspace = (workspace: WorkspaceRecord, ticketShorthand: string) =>
  workspace.ticket_shorthand === ticketShorthand || workspace.workspace_shorthand?.startsWith(`${ticketShorthand}_`);

export default {
  hooks: {
    postTicketArchive: {
      eventId: "kernel.postTicketArchive",
      async handler(ctx, payload: TicketArchivePayload) {
        const workspaces = payload.workspaces
          ? payload.workspaces
          : ((await ctx.workspaces.list()) as WorkspaceRecord[]).filter((workspace) =>
              isTicketWorkspace(workspace, payload.shorthand),
            );
        const archived = workspaces.filter((workspace) => workspace.worktree_path);

        for (const workspace of archived) {
          await ctx.workspaces.removeWorktree(workspace.id);
        }
      },
    },

    postWorktreeCreate: {
      eventId: "kernel.postWorktreeCreate",
      async handler(ctx, payload: WorktreeCreatePayload) {
        copyProjectFiles(payload.repoPath, payload.worktreePath);
        await assertCommand(ctx.process, payload.worktreePath, ["bun", "install"]);
        if (payload.ticket) {
          await assertCommand(ctx.process, payload.worktreePath, [
            "bun",
            "packages/pstdio/src/index.ts",
            "tickets",
            "pull",
            "--id",
            payload.ticket,
          ]);
        }
        await assertCommand(ctx.process, payload.worktreePath, ["bun", "run", "build"]);
      },
    },
  },
};
