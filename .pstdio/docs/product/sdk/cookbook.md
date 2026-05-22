# SDK Cookbook

Use the SDK client for API automation and `@pstdio/sdk/extensions` for packaged automation.

## Create a Client

```ts
import { createClient } from "@pstdio/sdk/client";

const client = createClient({
  baseUrl: process.env.PSTDIO_API_URL,
});
```

## List Tickets

```ts
const tickets = await client.tickets.list(projectId, {
  status: "wip",
});
```

## Create an Extension Command

```ts
import type { ExtensionDefinition } from "@pstdio/sdk/extensions";

const extension: ExtensionDefinition = {
  manifest: {
    id: "example",
    name: "Example",
    version: "0.0.0",
  },
  activate(ctx) {
    ctx.commands.register({
      id: "example.refine-ticket",
      title: "Refine ticket",
      handler: async (commandCtx) => {
        const ticket = await commandCtx.tickets.get(commandCtx.params.ticket);
        await commandCtx.sessions.create({
          project_id: commandCtx.projectId,
          title: `Refine ${ticket.shorthand}`,
          prompt: `Refine ${ticket.shorthand}: ${ticket.title}`,
        });
      },
    });
  },
};

export default extension;
```

## Reject a Command with Middleware

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
