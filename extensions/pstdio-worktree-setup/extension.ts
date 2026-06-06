import { defineExtension, worktreeEvents } from "@pstdio/sdk/extensions";

export default defineExtension({
  hooks: {
    worktreeCreated: {
      event: worktreeEvents.created,
      async handler(ctx, payload) {
        await ctx.worktrees.bootstrap({
          repoPath: payload.repoPath,
          worktreePath: payload.worktreePath,
        });

        // add custom worktree setup logic here
      },
    },
  },
});
