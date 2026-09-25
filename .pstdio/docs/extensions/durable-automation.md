# Durable extension work

Use `ctx.automation` for work that lasts longer than the request that starts it. Use `ctx.process` for work the caller awaits. A detached process has no durable run record.

Declare the worker command with `automation: true`. A command can enqueue only a worker owned by the same extension. This uses the same flag as machine-token automation; machine tokens still need an explicit command scope.

```ts
const run = await ctx.automation.enqueue({
  command: executeRun.ref,
  input: { params: { runId } },
  key: runId,
});

const current = await ctx.automation.get(run.id);
const active = await ctx.automation.list({ status: ["queued", "running"] });
await ctx.automation.cancel(run.id);
```

`command` accepts a command ref or a fully qualified command ID. `input` accepts only `workspaceId`, `params`, `resource`, and `metadata`. Command parameters are validated before a new run is admitted. Pass `workspaceId` when the worker needs a workspace. The worker gets a normal command context, `source: "automation"`, and `ctx.signal` for cancellation.

The host stores the run before returning. Closing a panel or reloading the dashboard does not cancel it. `get`, `list`, and `cancel` use the caller's extension and project. `get` returns `undefined` for an unknown or foreign run. `cancel` rejects unknown or foreign runs. `list()` includes all statuses; an empty status array matches no runs.

The required `key` is unique within the extension, project, and command. Repeating a key with the same input returns the existing run, including a finished run. Different input rejects with `idempotency_conflict`. Use a new key for new work or a retry of a finished run.

## Refreshing a view

Add the event ID `${ctx.extensionId}.event.automation-run-changed` to the view's `refreshEvents`, using the extension's known ID in its declaration. For example:

```ts
refreshEvents: ["example.experiments.event.automation-run-changed"]
```

The host emits this event for queued, running, succeeded, failed, rejected, and cancelled transitions. Its payload includes `runId`, `commandId`, and `status`. Hooks and native view refreshes use the normal extension event dispatcher. The event name is scoped to the extension that owns the run. It contains no input, result, or error details.

## Recovery and limits

After a host restart, queued runs execute. Interrupted running runs become `failed` with `{ code: "host_restarted", retryable: true }`. They do not resume automatically. Keep domain checkpoints, progress, and large outputs in extension storage or artifact mounts. The extension decides which work a new run can skip.

Cancellation aborts `ctx.signal` and waits for command cleanup. A cancelled worker settles as `cancelled`. If cleanup is still pending, cancellation returns `automation_cancellation_pending`; read the run again to see when it finishes. Graceful host shutdown also cancels active runs.

- Input: 64 KB, including the command ID and input envelope.
- Result: 64 KB. Error: 8 KB.
- Idempotency key: 1 to 200 characters.
- Admission: 60 new runs per minute per extension and project by default, controlled by `config.automation.runsPerMinute`.
- Terminal runs: pruned after 30 days. Keys can be reused after their run is pruned.

Use `AutomationRun` and `AutomationRunStatus` from `@pstdio/sdk/extensions` for stored run handles. The host owns run supervision. Extensions own retry policies, checkpoints, progress, and their run tables. The [automation directory](./automation/) describes lifecycle hooks, which are a separate feature.
