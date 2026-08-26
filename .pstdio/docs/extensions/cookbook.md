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
    "pstdio": "1.0.0-alpha.4"
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
        examples: ['pst planner tickets create --title "Add review status"'],
      },
      params: {
        title: params.text({ label: "Title", required: true }),
      },
      async run(_ctx, commandParams) {
        return { title: commandParams.title };
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
          target: "workbench.nav.actions",
          label: "Run attempt",
          icon: "play",
          presentation: "button",
          when: { resourceType: ["ticket"] },
        },
      ],
      async run(ctx, _commandParams) {
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
      async handler(ctx, commandParams) {
        if (commandParams.status !== "review-ready")
          return ctx.commands.continue();

        const workspace = await ctx.workspaces.get(commandParams.workspaceId);
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
import { defineExtension, sessionEvents } from "@pstdio/sdk/extensions";

export default defineExtension({
  hooks: {
    recordStartedSession: {
      event: sessionEvents.started,
      async handler(ctx, event) {
        await ctx.storage.set(
          `session:${event.session.id}:started`,
          new Date().toISOString(),
        );
      },
    },
  },
});
```

Use hooks for follow-up automation such as worktree cleanup, session creation,
notifications, and activity records. Planner ticket workflow automation should
run through planner commands/storage rather than removed core ticket events.

## Observe Command Lifecycle

Use `commandEvent()` when a hook should react to a command outcome:

```ts
import {
  commandEvent,
  commandRef,
  defineExtension,
} from "@pstdio/sdk/extensions";

const plannerCommand = commandRef.forExtension({ publisher: "pstdio", name: "planner" });
const publishCommand = plannerCommand<{ version: string }, { published: boolean }>("publish");

export default defineExtension({
  commands: {
    publish: {
      title: "Publish",
      async run(_ctx, _commandParams) {
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

## Add A View And Navigation Item

```ts
import {
  defineExtension,
  defineNavigationItem,
  defineView,
  packageAsset,
  workbenchSlots,
} from "@pstdio/sdk/extensions";

const planner = defineView({
  id: "planner",
  path: "planner",
  title: "Planner",
  body: {
    kind: "webview",
    entry: packageAsset("./webviews/planner.tsx", import.meta.url),
    capabilities: ["commands.execute", "notification.show"],
  },
});

export default defineExtension({
  views: [planner],
  navigationItems: [
    defineNavigationItem({
      id: "planner",
      slot: workbenchSlots.projectNavigation,
      label: "Planner",
      icon: "calendar-check",
      action: { kind: "view", view: planner.ref },
    }),
  ],
});
```

The view has the normalized id `publisher.name.view.planner`. Its `path` adds a deep
link without creating another UI contribution. Use the returned `planner.ref` anywhere
the extension needs to target this view.

## Call Commands From A Webview

Export the commands record and the settings contribution, then build a typed client in
the view. Type-only imports keep server code out of the webview bundle.

```ts
// src/commands/index.ts
import { defineCommand, params } from "@pstdio/sdk/extensions";

export const commands = {
  "ticketStatus.read": defineCommand({
    title: "Read ticket statuses",
    async run(_ctx, _commandParams) {
      return { statuses: [] as { id: string; name: string }[] };
    },
  }),
  "ticketStatus.create": defineCommand({
    title: "Create ticket status",
    params: { label: params.text({ required: true }) },
    async run(_ctx, commandParams) {
      return { id: commandParams.label };
    },
  }),
};
```

```tsx
// src/webviews/statuses.tsx
import { createWebviewClient, defineExtensionView } from "@pstdio/sdk/extensions";
import { useCommandMutation, useCommandQuery } from "@pstdio/sdk/extensions/react";
import type { commands } from "../commands";

export default defineExtensionView({
  render({ mount, host }) {
    const client = createWebviewClient<typeof commands>(host);

    const StatusList = () => {
      const statuses = useCommandQuery({
        queryKey: ["ticket-statuses"],
        command: client.commands["ticketStatus.read"],
      });
      const createStatus = useCommandMutation({
        command: client.commands["ticketStatus.create"],
        invalidate: [["ticket-statuses"]],
      });

      // render statuses.data and call createStatus.mutate({ label: "Todo" })
      return null;
    };

    // mount the React root with <StatusList /> under a QueryClientProvider
  },
});
```

Wrong param shapes, wrong result uses, and unknown command keys fail to compile. Pass
the settings contribution type as the second type argument for typed `client.settings`.

## Compose A Resource Screen

Declare the resource kind and its slots. Bind views to slots with `resourceViews`, then place the slots in a mode.

```ts
import {
  defineExtension,
  definePlacement,
  defineResourceKind,
  defineResourceView,
  defineView,
  packageAsset,
  resourceSlotRef,
  workbenchModes,
} from "@pstdio/sdk/extensions";

const ticket = defineResourceKind({
  id: "ticket",
  surface: "primary",
  slots: [
    { id: "primary", cardinality: "one", access: "owner" },
    { id: "navigation", cardinality: "one", access: "public" },
  ],
});
const primary = resourceSlotRef(ticket.ref, "primary");
const navigation = resourceSlotRef(ticket.ref, "navigation");
const editor = defineView({
  id: "ticket-editor",
  title: "Ticket",
  body: { kind: "webview", entry: packageAsset("./webviews/ticket-editor.tsx", import.meta.url) },
});
const files = defineView({
  id: "ticket-files",
  title: "Files",
  body: { kind: "tree", body: async () => [] },
});

export default defineExtension({
  resourceKinds: [ticket],
  views: [editor, files],
  resourceViews: [
    defineResourceView({ id: "editor", resourceKind: ticket.ref, slot: primary, view: editor.ref }),
    defineResourceView({ id: "files", resourceKind: ticket.ref, slot: navigation, view: files.ref }),
  ],
  placements: [
    definePlacement({ id: "editor", mode: workbenchModes.project, item: { kind: "resource-slot", slot: primary }, region: "main", required: true }),
    definePlacement({ id: "files", mode: workbenchModes.project, item: { kind: "resource-slot", slot: navigation }, region: "sidenav", required: true }),
  ],
});
```

Another extension can bind its view to the public `navigation` slot by importing the typed
resource-kind and slot refs. Geometry remains in `placements`; the binding never decides a region.

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
pst extensions check
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
