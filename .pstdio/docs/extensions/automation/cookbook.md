# Extension Automation Cookbook

## Validate Before Handing Work to Review

Use middleware on the planner command that starts a review:

```ts
ctx.commands.middleware("pstdio-planner.run-review", async (commandCtx, next) => {
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
});
```

## React to Worktree Creation

Use the worktree-created event:

```ts
ctx.events.on("worktree.created", async (event) => {
  await ctx.worktrees.bootstrap(event.workspaceId);
});
```

## React to Session Lifecycle

Stored workspace statuses no longer exist; workspace state is derived from live
sessions (`pstdio-planner.workspace-activity`). React to session lifecycle
events instead, the way the repo-local `pstdio-planner-loops` extension moves
tickets to `In Progress` when a session starts:

```ts
import { defineExtension, sessionEvents } from "@pstdio/sdk/extensions";

export default defineExtension({
  hooks: {
    sessionStarted: {
      event: sessionEvents.started,
      async handler(ctx, payload) {
        await ctx.storage.set(`started:${payload.sessionId}`, new Date().toISOString());
      },
    },
  },
});
```

For recurring planner automation, define an ordinary extension command and bind
it through `schedules`; keep event-driven behavior in `hooks`. Use extension
settings for project policy and extension storage only for durable reconciliation
state.
