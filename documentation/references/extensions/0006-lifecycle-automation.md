# Lifecycle automation

Extensions automate work with commands, middleware, hooks, and schedules. This page explains how they fit together.

Commands are the unit of work. Middleware can change or reject a command before its handler runs. Hooks observe emitted events. Schedules invoke commands at configured times.

## Commands and middleware

Declare commands with `defineCommand` and middleware with `defineMiddleware`. Register them in the extension's `commands` and `middlewares` arrays.

A middleware handler receives `(ctx, params)`. It returns a decision from `ctx.commands`: `continue`, `patchParams`, `replaceParams`, `replaceInvocation`, or `reject`. Returning nothing also continues. There is no `next()` callback. Middleware can protect a transition only when the transition runs through the command it targets.

To call another extension's command, use the command ref that extension exports. Tickets, statuses, tags, and attempts belong to the Planner extension, not to the core host.

## Events and payloads

Declare hooks with `defineHook({ id, event, run })` and register them in `hooks`. Use typed refs from `@pstdio/sdk/extensions`, including `projectEvents`, `workspaceEvents`, `worktreeEvents`, `sessionEvents`, and `gitEvents`. `commandEvent(ref, phase)` observes a command's lifecycle. `artifactChanged(mount)` observes direct edits to a watched artifact mount; see [Watched mounts](0005-webview-and-storage-api.md#watched-mounts).

Callbacks receive the context and a typed payload. Payload fields use camelCase and include the resource identifiers needed to load further data. Use their exported types instead of assuming every event shares one payload.

Most hooks do follow-up work after a change was accepted. Provisioning is different: the host waits for `workspaceEvents.provision` hooks before it marks a workspace ready. `workspaceEvents.ready` is for setup after readiness. See the [hook runtime boundaries](../architecture/0011-hooks-runtime-boundaries.md).

## Schedules and durable work

Use `defineSchedule` to bind a cron schedule to a command. A project's automation toggle overrides the author's enabled default.

Use `ctx.automation.enqueue` for accepted work that needs a durable run record beyond the invoking request. See [durable automation](0007-durable-automation.md) for limits, cancellation, retries, and restart behavior. An unawaited promise is not durable execution.

## Logging

Log rejected middleware decisions with the command and resource IDs. Record command outcome and duration. Report hook failures at the event boundary; a failed background hook must not be presented as rollback of an already accepted change.

Never put credentials or connection secrets in logs.

## Examples

The [automation cookbook](../../guides/extensions/0003-automation.md) has complete middleware and hook examples. The [command API](0003-command-and-process-api.md) describes contexts and outcomes.
