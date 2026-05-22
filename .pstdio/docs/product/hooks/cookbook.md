# Extension Automation Cookbook

## Validate Before Review Ready

Use middleware on the workspace attempt-status command:

```ts
ctx.commands.middleware("workspaceCommands.setAttemptStatus", async (commandCtx, next) => {
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
});
```

## React to Worktree Creation

Use the worktree-created event:

```ts
ctx.events.on("worktree.created", async (event) => {
  await ctx.worktrees.bootstrap(event.workspaceId);
});
```

## React to Attempt Status Changes

Use the attempt-status changed event:

```ts
ctx.events.on("attemptStatus.changed", async (event) => {
  if (event.toStatus !== "review-ready") return;
  await ctx.sessions.create({
    project_id: event.projectId,
    title: `Review ${event.workspaceShorthand}`,
    prompt: `Review ${event.workspaceShorthand}`,
    cwd: event.worktreePath,
  });
});
```
