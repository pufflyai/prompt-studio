# Hooks

A hook runs an action when something happens in Prompt Studio, such as checking a result when an agent finishes its work.

## What hooks give you

A hook watches for an event and runs code after it. Events include an agent session starting or finishing, a workspace being created or ready, a Git commit or merge, and a command completing. A tool can use a hook to record what happened, update its own data, send a notification, or start follow-up work.

A hook reacts to a change that already happened. It cannot undo or block it. To check or stop a command before it runs, use middleware, declared with `defineMiddleware`, instead.

For example, Planner's **Auto Build** hooks finished sessions, so its supervisor can check whether more ticket work can run.

## Use hooks in Prompt Studio

Hooks run on their own once the extension that declares them is installed and turned on in the project. There is nothing to start.

To see an extension's hooks, run `pst extensions check <extension-folder>` on its source folder. For installed extensions, `pst extensions check --json` includes each hook with the event it observes.

## Add a hook to your tool

Declare a hook with `defineHook`, give it an event, and list it in `defineExtension({ hooks })`. This hook records each finished agent session:

```ts
import { defineExtension, defineHook, sessionEvents } from "@pstdio/sdk/extensions";

const recordFinishedSession = defineHook({
  id: "record-finished-session",
  event: sessionEvents.completed,
  async run(ctx, { sessionId, sessionStatus }) {
    await ctx.storage.set("lastFinishedSession", { sessionId, sessionStatus });
  },
});

export default defineExtension({ hooks: [recordFinishedSession] });
```

`sessionEvents.completed` fires when a run ends with any final status: `completed`, `failed`, `cancelled`, or `disconnected`. Read `sessionStatus` to tell them apart, or use `sessionEvents.succeeded` and `sessionEvents.failed`.

Other exported event refs include `sessionEvents.started`, `workspaceEvents.created`, `workspaceEvents.ready`, `worktreeEvents.removed`, `projectEvents.opened`, and `gitEvents`. To react to a command, hook `commandEvent(<command ref>, "completed")`.

Two events behave differently:

- The host waits for `workspaceEvents.provision` hooks before it marks a workspace ready. A failed provision hook keeps the workspace from becoming ready.
- Core has no ticket events. Tickets belong to Planner, so hook Planner's commands instead.

A hook's results are not visible from `pst` unless the tool has a read command for them.

## Learn more

- [Automation cookbook](../extensions/0003-automation.md#react-to-lifecycle-events) has complete hook and middleware examples.
- [Middlewares and hooks](../../references/extensions/0003-command-and-process-api.md#middlewares-and-hooks) describes both in the command reference.
- [Lifecycle automation](../../references/extensions/0006-lifecycle-automation.md#events-and-payloads) lists event refs and payloads.

*Updated at: 2026-11-22*
