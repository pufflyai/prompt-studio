import { existsSync } from "node:fs";
import { cp, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

import { bootstrapWorktree, definePlugin, removeAllWorktreesForTicket, runCommand } from "@pstdio/sdk/plugins";

// Gitignored files that the frontend (and Docker Compose dev stack) need at
// runtime. They are copied from the primary checkout into each new worktree
// so `yarn dev`, `vite`, and `docker compose` work without manual setup.
const ENV_FILES_TO_COPY = [
  "dev/.env",
  "frontend/.env",
  "frontend/.env.runtime.local",
  "frontend-nxt/.env",
  "frontend-nxt/.env.runtime.local",
];

const YARN_INSTALL_DIRS = ["frontend", "frontend-nxt", "e2e"];

const copyIfExists = async (sourcePath: string, destPath: string) => {
  if (!existsSync(sourcePath)) return;
  await mkdir(dirname(destPath), { recursive: true });
  await cp(sourcePath, destPath, { force: true });
};

const yarnInstallIfPackage = async (dir: string) => {
  if (!existsSync(join(dir, "package.json"))) return;
  await runCommand(dir, ["yarn", "install", "--frozen-lockfile"]);
};

export default definePlugin({
  hooks: {
    // ──────────────────────────────────────────────────────────
    // Deletes all worktrees linked to the archived ticket to prevent stale
    // worktrees from lingering in local environments.
    // ──────────────────────────────────────────────────────────
    async postTicketArchive(ctx) {
      await removeAllWorktreesForTicket(ctx, { ticketId: ctx.id });
    },

    // ──────────────────────────────────────────────────────────
    // Runs after a worktree is created.
    // Bootstraps shared project files, copies gitignored env files needed by
    // the frontend dev stack, and pulls the ticket information.
    // ──────────────────────────────────────────────────────────
    async postWorktreeCreate(ctx) {
      await bootstrapWorktree(ctx, {
        repoPath: ctx.repoPath,
        worktreePath: ctx.worktreePath,
        ticketId: ctx.ticket,
      });

      await Promise.all(
        ENV_FILES_TO_COPY.map((relativePath) =>
          copyIfExists(join(ctx.repoPath, relativePath), join(ctx.worktreePath, relativePath)),
        ),
      );

      for (const relativeDir of YARN_INSTALL_DIRS) {
        await yarnInstallIfPackage(join(ctx.worktreePath, relativeDir));
      }
    },
  },
});
