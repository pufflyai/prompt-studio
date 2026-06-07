import { defineExtension, worktreeEvents } from "@pstdio/sdk/extensions";

const INSTALL_COMMAND = ["bun", "install", "--frozen-lockfile"];
const BUILD_COMMAND = ["bun", "run", "build"];

export default defineExtension({
  hooks: {
    worktreeCreated: {
      event: worktreeEvents.created,
      async handler(ctx, payload) {
        await ctx.process.runOrThrow({
          command: INSTALL_COMMAND,
          cwd: payload.worktreePath,
        });

        await ctx.process.runOrThrow({
          command: BUILD_COMMAND,
          cwd: payload.worktreePath,
        });
      },
    },
  },
});
