# Extension automation cookbook

Declare middleware and hooks with contribution helpers. Register the returned
values in the extension's `middlewares` and `hooks` arrays. Callbacks receive
context as the first argument and parameters or event payload as the second.

## Validate a command before it runs

This example adds a project policy requiring a title on Planner ticket creation.
The Planner extension must be enabled in the same project.

```ts
import { commandRef, defineExtension, defineMiddleware } from "@pstdio/sdk/extensions";

const createTicket = commandRef.forExtension({ publisher: "pstdio", name: "pstdio-planner" })<{
  title?: string;
}>("create-ticket");

const requireTitle = defineMiddleware<{ title?: string }>({
  id: "require-title",
  command: createTicket,
  run(ctx, commandParams) {
    if (!commandParams.title?.trim()) {
      return ctx.commands.reject({ code: "missing-title", reason: "Supply a ticket title." });
    }
    return ctx.commands.continue();
  },
});

export default defineExtension({ middlewares: [requireTitle] });
```

Middleware may continue, reject, patch parameters, or replace the invocation.
It does not call a `next` handler. Prefer a provider's exported command ref when
one is available so its parameter and result types stay connected to the provider.

## React to lifecycle events

Use exported event refs and `defineHook`. Hooks observe accepted changes and
cannot reject the operation that emitted an event.

```ts
import { defineExtension, defineHook, sessionEvents, workspaceEvents } from "@pstdio/sdk/extensions";

const recordWorkspace = defineHook({
  id: "record-created-workspace",
  event: workspaceEvents.created,
  async run(ctx, event) {
    await ctx.storage.set("lastWorkspaceId", event.workspace.id);
  },
});

const recordSession = defineHook({
  id: "record-started-session",
  event: sessionEvents.started,
  async run(ctx, event) {
    await ctx.storage.set("lastSessionId", event.sessionId);
  },
});

export default defineExtension({ hooks: [recordWorkspace, recordSession] });
```

Use `workspaceEvents.ready` for background setup after a local workspace is ready.
The host awaits `workspaceEvents.provision` handlers before marking that workspace
ready; failed provisioning prevents readiness. `worktreeEvents.removed` observes
local worktree cleanup.

Workspace activity comes from sessions and Planner's managed attempts. For ticket
workflow automation, use Planner commands or `commandEvent(commandRef, "completed")`.
Core ticket events and stored workspace review statuses are not part of this API.

For recurring work, bind an extension command through `defineSchedule`. Use
settings for project policy and storage for data that must survive a restart.
See the [extension API](../api.md) for command outcomes, schedules, and context APIs.
