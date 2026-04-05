import { bootstrapWorktree, definePlugin, removeAllWorktreesForTicket, runCommand } from "@pstdio/sdk/plugins";

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
    // Bootstraps shared project files, and pulls the ticket information.
    // ──────────────────────────────────────────────────────────
    async postWorktreeCreate(ctx) {
      // add skills, pstdio config and ticket to the worktree
      await bootstrapWorktree(ctx, {
        repoPath: ctx.repoPath,
        worktreePath: ctx.worktreePath,
        ticketId: ctx.ticket,
      });

      // ──────────────────────────────────────────────────────────
      // Add additional setup steps below.
      // ──────────────────────────────────────────────────────────
      await runCommand(ctx.worktreePath, ["bun", "install"]);
      await runCommand(ctx.worktreePath, ["bun", "run", "build"]);
    },
  },
});
