import { defineExtension, type EventContext, type EventRef, worktreeEvents } from "@pstdio/sdk/extensions";

const INSTALL_COMMAND = ["bun", "install", "--frozen-lockfile"];
const BUILD_COMMAND = ["bun", "run", "build"];

type EventPayload<TEvent> = TEvent extends EventRef<infer TPayload> ? TPayload : never;

const setupPromptStudioWorktree = async (ctx: EventContext, event: EventPayload<typeof worktreeEvents.created>) => {
  await ctx.worktrees.bootstrap({
    repoPath: event.repoPath,
    ticketId: event.ticket,
    worktreePath: event.worktreePath,
  });

  await ctx.process.runOrThrow({
    command: INSTALL_COMMAND,
    cwd: event.worktreePath,
  });

  await ctx.process.runOrThrow({
    command: BUILD_COMMAND,
    cwd: event.worktreePath,
  });
};

export default defineExtension({
  hooks: {
    worktreeCreated: {
      event: worktreeEvents.created,
      handler: setupPromptStudioWorktree,
    },
  },
});
