import type { EventContext } from "@pstdio/sdk/extensions";

type WorktreeCreatedPayload = {
  repoPath: string;
  ticket: string;
  worktreePath: string;
};

export default {
  hooks: {
    worktreeCreated: {
      eventId: "worktree.created",
      async handler(ctx: EventContext, payload: WorktreeCreatedPayload) {
        await ctx.worktrees.bootstrap({
          repoPath: payload.repoPath,
          worktreePath: payload.worktreePath,
          ticketId: payload.ticket,
        });

        // add custom worktree setup logic here
      },
    },
  },
};
