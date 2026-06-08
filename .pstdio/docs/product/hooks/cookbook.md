# Extension Automation Cookbook

## Validate Before Review Ready

Use middleware on the planner command that marks a workspace review-ready:

```ts
ctx.commands.middleware(
  "pstdio-planner.workspaceStatus.set",
  async (commandCtx, next) => {
    if (commandCtx.params.status !== "review-ready") {
      return next();
    }

    const result = await commandCtx.shell.run({
      command: ["bun", "run", "validate"],
      cwd: commandCtx.workspace.worktree_path,
    });

    if (result.exitCode !== 0) {
      return {
        status: "rejected",
        message: result.stderr || result.stdout || "Validation failed",
      };
    }

    return next();
  },
);
```

## React to Worktree Creation

Use the worktree-created event:

```ts
ctx.events.on("worktree.created", async (event) => {
  await ctx.worktrees.bootstrap(event.workspaceId);
});
```

## React to Planner Workspace Status Changes

Use planner command lifecycle events or planner-owned automation. Core
`attemptStatus.changed` events no longer exist.

```ts
import {
  commandEvent,
  commandRef,
  defineExtension,
} from "@pstdio/sdk/extensions";

const setWorkspaceStatus = commandRef("pstdio-planner.workspaceStatus.set");

export default defineExtension({
  hooks: {
    afterWorkspaceStatusSet: {
      event: commandEvent(setWorkspaceStatus, "completed"),
      async handler(ctx, event) {
        if (event.params.status !== "review-ready") return;
        await ctx.storage.set(
          `review-ready:${event.params.workspaceId}`,
          new Date().toISOString(),
        );
      },
    },
  },
});
```
