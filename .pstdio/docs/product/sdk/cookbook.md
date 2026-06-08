# SDK Cookbook

Use the SDK client for core API automation and `@pstdio/sdk/extensions` for
packaged automation.

## Create a Client

```ts
import { createClient } from "@pstdio/sdk/client";

const client = createClient({
  baseUrl: process.env.PSTDIO_API_URL,
});
```

## List Core Sessions

```ts
const sessions = await client.sessions.list(projectId, {
  status: "in_progress",
});
```

## Execute a Planner Command

Planner tickets are extension-owned, so programmatic access goes through the
extension command API.

```ts
const response = await client.extensions.execute(
  "pstdio-planner.list-tickets",
  {
    projectId,
    params: { status: "In Progress" },
  },
);

if (response.outcome.ok) {
  console.log(response.outcome.value);
}
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
      id: "example.start-review",
      title: "Start review",
      handler: async (commandCtx) => {
        await commandCtx.sessions.create({
          project_id: commandCtx.projectId,
          workspace_id: commandCtx.params.workspaceId,
          title: "Review workspace",
          prompt: "Review this workspace and report requested changes.",
        });
      },
    });
  },
};

export default extension;
```

## Reject a Command with Middleware

```ts
ctx.commands.middleware(
  "example.mark-review-ready",
  async (commandCtx, next) => {
    const workspace = await commandCtx.workspaces.get(
      commandCtx.params.workspaceId,
    );
    if (!workspace?.worktree_path) return next();

    const result = await commandCtx.shell.run({
      command: ["bun", "run", "validate"],
      cwd: workspace.worktree_path,
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
