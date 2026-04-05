import { bootstrapWorktree, definePlugin, removeAllWorktreesForTicket, runCommand } from "@pstdio/sdk/plugins";

export default definePlugin({
  hooks: {
    async postTicketArchive(ctx) {
      await removeAllWorktreesForTicket(ctx, { ticketId: ctx.id });
    },

    async postWorktreeCreate(ctx) {
      await bootstrapWorktree(ctx, {
        repoPath: ctx.repoPath,
        worktreePath: ctx.worktreePath,
        ticketId: ctx.ticket,
      });

      await runCommand(ctx.worktreePath, ["bun", "install"]);
      await runCommand(ctx.worktreePath, ["bun", "run", "build"]);
    },
  },
});
