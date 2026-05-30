# Extension Cookbook

This cookbook gives short recipes for the implemented extension API.

## Create A Package

```txt
~/.pstdio/extensions/planner/
  package.json
  extension.ts
  templates/
  skills/
  webviews/
```

`package.json` owns identity:

```json
{
  "name": "planner",
  "version": "0.1.0",
  "publisher": "pstdio",
  "main": "./extension.ts",
  "engines": {
    "pstdio": "^1.0.0"
  },
  "type": "module",
  "dependencies": {
    "@pstdio/sdk": "latest"
  }
}
```

## Add A CLI Command

```ts
import { defineExtension, params } from "@pstdio/sdk/extensions";

export default defineExtension({
  commands: {
    "tickets.create": {
      title: "Create ticket",
      cli: {
        path: ["tickets", "create"],
        examples: ["pstdio planner tickets create --title \"Add review status\""],
      },
      params: {
        title: params.text({ label: "Title", required: true }),
      },
      async run(ctx) {
        return { title: ctx.params.title };
      },
    },
  },
});
```

## Add A Dashboard Header Action

```ts
import { defineExtension } from "@pstdio/sdk/extensions";

export default defineExtension({
  commands: {
    runAttempt: {
      title: "Run attempt",
      cli: true,
      menus: [
        {
          target: "workbench.top.actions",
          label: "Run attempt",
          icon: "play",
          presentation: "button",
          when: { resourceType: ["ticket"] },
        },
      ],
      async run(ctx) {
        return { ticket: ctx.resource?.id };
      },
    },
  },
});
```

## Add Middleware

Middleware runs before a command. Use it when the extension needs to validate, reject, or rewrite command invocation.

```ts
import { defineExtension, workspaceCommands } from "@pstdio/sdk/extensions";

export default defineExtension({
  middlewares: {
    requireReviewReadyChecks: {
      command: workspaceCommands.setAttemptStatus,
      async handler(ctx) {
        if (ctx.params.status !== "review-ready") return ctx.commands.continue();

        const workspace = await ctx.workspaces.get(ctx.params.workspaceId);
        if (!workspace?.worktree_path) return ctx.commands.continue();

        const result = await ctx.process.run({
          command: ["bun", "run", "test"],
          cwd: workspace.worktree_path,
        });

        if (result.exitCode === 0) return ctx.commands.continue();

        return ctx.commands.reject({
          code: "review_ready_checks_failed",
          reason: "Tests must pass before marking an attempt review-ready.",
        });
      },
    },
  },
});
```

Middleware can return:

- `ctx.commands.continue()`
- `ctx.commands.patchParams({ ... })`
- `ctx.commands.replaceParams({ ... })`
- `ctx.commands.replaceInvocation({ ... })`
- `ctx.commands.reject({ code, reason })`
- nothing, which is treated as continue

## Add A Hook

Hooks observe emitted events. They do not veto the event or mutate the operation that emitted it.

```ts
import { defineExtension, ticketEvents } from "@pstdio/sdk/extensions";

export default defineExtension({
  hooks: {
    removeWorktreesForArchivedTicket: {
      event: ticketEvents.archived,
      async handler(ctx, event) {
        await ctx.worktrees.removeAllForTicket({ ticketId: event.ticket.id });
      },
    },
  },
});
```

Use hooks for follow-up automation such as status updates, worktree cleanup, session creation, notifications, and activity records.

## Observe Command Lifecycle

Use `commandEvent()` when a hook should react to a command outcome:

```ts
import { commandEvent, commandRef, defineExtension } from "@pstdio/sdk/extensions";

const publishCommand = commandRef<{ version: string }, { published: boolean }>("planner.publish");

export default defineExtension({
  commands: {
    publish: {
      title: "Publish",
      async run() {
        return { published: true };
      },
    },
  },
  hooks: {
    recordPublishFailure: {
      event: commandEvent(publishCommand, "failed"),
      async handler(ctx, event) {
        await ctx.activity.record({
          message: `Publish failed: ${event.reason}`,
        });
      },
    },
  },
});
```

## Add A Route And Sidebar Link

```ts
import { defineExtension, packageAsset } from "@pstdio/sdk/extensions";

export default defineExtension({
  routes: {
    planner: {
      path: "planner",
      label: "Planner",
      webview: {
        entry: packageAsset("./webviews/planner.tsx", import.meta.url),
        capabilities: ["commands.execute", "notification.show"],
      },
    },
  },
  treeItems: {
    planner: {
      target: "workbench.left.tree",
      group: "Planner",
      label: "Planner",
      icon: "calendar-check",
      action: { kind: "route", route: "planner" },
      when: { mode: "project" },
    },
  },
});
```

## Add Packaged Assets

```ts
import { defineExtension, packageAsset } from "@pstdio/sdk/extensions";

export default defineExtension({
  templates: {
    reviewPrompt: {
      title: "Review prompt",
      type: "ticket",
      source: packageAsset("./templates/review.md", import.meta.url),
    },
  },
  skills: {
    reviewer: {
      title: "Reviewer",
      source: packageAsset("./skills/reviewer", import.meta.url),
    },
  },
});
```

## Validate An Extension

```bash
pstdio extensions check
bun run --cwd extensions/<name> typecheck
```

For repo validation after non-documentation changes, run:

```bash
bun run validate
```

When bundled runtime artifacts change, also run:

```bash
bun run scripts/verify-packages.ts
```
