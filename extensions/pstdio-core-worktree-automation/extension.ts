import { appendFile } from "node:fs/promises";
import { join } from "node:path";
import { defineExtension, worktreeEvents } from "@pstdio/sdk/extensions";

const worktreeGitignoreEntry = "\n# pstdio worktree automation\n/.pstdio/tickets/\n";

export default defineExtension({
  hooks: {
    worktreeCreated: {
      event: worktreeEvents.created,
      async handler(ctx, payload) {
        await appendFile(join(payload.worktreePath, ".gitignore"), worktreeGitignoreEntry);
        await ctx.worktrees.bootstrap({
          repoPath: payload.repoPath,
          worktreePath: payload.worktreePath,
          ticketId: payload.ticket,
        });
      },
    },
  },
});
