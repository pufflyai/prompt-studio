# Extension Notifications

Extensions have three user-facing surfaces for events:

| Surface | API | Use it for |
| --- | --- | --- |
| Activity | `ctx.activity.record(...)` | Durable history of what happened. |
| Toast | `ctx.notify.toast(...)` | Ephemeral feedback the user does not need to revisit. |
| Notifications | `ctx.notify.action(...)` | Durable pending work the user or an agent still needs to resolve. |

Use notifications only for actionable items such as review, approval, merge, unblock, retry, or failure recovery. Routine progress belongs in activity, and short success/error feedback belongs in toasts.

## Creating Action Items

`ctx.notify.action(...)` creates or updates a project-scoped inbox item. Provide a stable `dedupeKey` whenever the notification represents a source condition that may be emitted more than once.

```ts
await ctx.notify.action({
  title: "Review proposal: PS-42",
  body: "The proposal is ready for approval.",
  kind: "needs_review",
  priority: "high",
  target: { type: "ticket", id: "ticket-42", label: "PS-42" },
  dedupeKey: "pstdio-planner:ticket:PS-42:proposal-refined",
  actions: [
    { id: "review", label: "Review proposal", kind: "open-resource", resource: { type: "ticket", id: "ticket-42" }, primary: true },
    { id: "approve", label: "Approve", kind: "command", command: "pstdio-planner.approve-proposal", params: { ticket: "PS-42" } },
  ],
});
```

Dedupe keys should follow `<extension-id>:<resource-type>:<resource-id>:<reason>`, for example `pstdio-planner:ticket:PS-42:blocked`. Re-emitting the same live key updates the existing row instead of creating duplicates.

## Actions

Notification actions are structured so the dashboard and CLI can run them safely:

- `open-resource` opens a ticket, session, workspace, or other resource.
- `command` runs a command by id with JSON params.
- `url` opens an external link.

Mark the preferred action with `primary: true`. For blocked agent flows, make the primary action open the waiting session so the user can reply.

## Resolving Items

Resolve source conditions when they stop being true:

```ts
await ctx.notify.resolve({
  dedupeKey: "pstdio-planner:ticket:PS-42:blocked",
  status: "done",
});
```

Use `resolve` for state-driven completion such as proposal approved, workspace merged, or ticket leaving blocked. Use `dismiss` only when the producer wants to remove an item without claiming the underlying work is complete.
