import { defineExtension, eventRef } from "@pstdio/sdk/extensions";

// Placeholder event refs — the kernel does not yet emit ticket-archive or
// worktree-create events. Once they're defined, swap these out for the
// canonical refs and the handler bodies below become live.
const ticketArchived = eventRef<{ ticketId: string }>("pstdio.tickets.archived");
const worktreeCreated = eventRef<{
  ticketId?: string;
  repoPath: string;
  worktreePath: string;
}>("pstdio.worktrees.created");

export default defineExtension({
  id: "pstdio.core-worktrees",
  namespace: "core-worktrees",
  name: "Core Worktrees",
  version: "0.1.0",
  description: "Worktree lifecycle automation migrated from the legacy worktree-lifecycle plugin.",

  hooks: {
    // Legacy: postTicketArchive(ctx) → removeAllWorktreesForTicket(ctx, { ticketId: ctx.id })
    cleanupWorktreesOnArchive: {
      event: ticketArchived,
      async handler(_ctx, _event) {
        // TODO(event): subscribe to the canonical ticket-archived event when the
        // kernel emits one.
        // TODO(helper): re-add the worktree cleanup once an extension equivalent
        // for `removeAllWorktreesForTicket` is exposed on `ctx`.
        // Original plugin body:
        //   await removeAllWorktreesForTicket(ctx, { ticketId: ctx.id });
      },
    },

    // Legacy: postWorktreeCreate(ctx) → bootstrapWorktree(ctx, { repoPath, worktreePath, ticketId })
    bootstrapNewWorktree: {
      event: worktreeCreated,
      async handler(_ctx, _event) {
        // TODO(event): subscribe to the canonical worktree-created event.
        // TODO(helper): re-add bootstrap once `bootstrapWorktree` is available
        // on the extension `ctx` (or expressible via `ctx.process.run`).
        // Original plugin body:
        //   await bootstrapWorktree(ctx, {
        //     repoPath: ctx.repoPath,
        //     worktreePath: ctx.worktreePath,
        //     ticketId: ctx.ticket,
        //   });
      },
    },
  },
});
