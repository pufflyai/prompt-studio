import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { defineExtension } from "@pstdio/sdk/extensions";

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
  worktree_path?: string | null;
};

type ProcessApi = {
  run(input: { command: string[]; cwd?: string }): Promise<{ exitCode: number; stdout: string; stderr: string }>;
};

const agentDirs = [".claude", ".opencode", ".agents"];

const copyProjectFiles = (repoPath: string, worktreePath: string) => {
  const repoConfig = join(repoPath, ".pstdio", "config.json");
  const worktreeConfigDir = join(worktreePath, ".pstdio");
  if (existsSync(repoConfig)) {
    mkdirSync(worktreeConfigDir, { recursive: true });
    cpSync(repoConfig, join(worktreeConfigDir, "config.json"));
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

export default defineExtension({
  hooks: {
    postTicketArchive: {
      eventId: "kernel.postTicketArchive",
      async handler(ctx, payload: TicketArchivePayload) {
        const workspaces = payload.workspaces ?? ((await ctx.workspaces.list()) as WorkspaceRecord[]);
        const archived = workspaces.filter(
          (workspace) => workspace.ticket_shorthand === payload.shorthand && workspace.worktree_path,
        );

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
});
