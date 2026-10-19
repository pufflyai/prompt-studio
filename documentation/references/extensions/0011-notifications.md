# Notifications

Extensions can report events as activity, toasts, or inbox notifications. This page explains when to use each and how notifications work.

The dashboard's notification center starts off. Users enable it in **Settings → Experimental → Beta features → Notifications**. Producers and CLI commands still work while it is off.

## Choose a surface

| Surface | API | Use it for |
| --- | --- | --- |
| Activity | `ctx.activity.record(...)` | Durable history of what happened. |
| Toast | `ctx.notify.toast(...)` | Ephemeral feedback the user does not need to revisit. |
| Notifications | `ctx.notify.action(...)` | Durable pending work the user or an agent still needs to resolve. |

Use notifications only for actionable items such as review, approval, merge, unblock, retry, or failure recovery. Routine progress belongs in activity, and short success feedback belongs in toasts. Show failed actions in the UI where the user tried the action. Errors never use toasts. The host's status-bar error widget is for system errors only.

## Creating Action Items

`ctx.notify.action(...)` creates or updates a project-scoped inbox item. Provide a stable `dedupeKey` whenever the notification represents a source condition that may be emitted more than once.

```ts
import { qualifyRef } from "@pstdio/sdk/extensions";

const ticketPage = qualifyRef("pstdio.pstdio-planner", { kind: "page", id: "ticket" });

await ctx.notify.action({
  title: "Review PRD: PS-42",
  body: "The PRD is ready for approval.",
  kind: "needs_review",
  priority: "high",
  target: { type: "ticket", id: "ticket-42", label: "PS-42" },
  dedupeKey: "pstdio-planner:ticket:PS-42:prd-refined",
  actions: [
    {
      id: "review",
      label: "Review PRD",
      kind: "navigate",
      target: { kind: "page", page: ticketPage, resource: { type: "ticket", id: "ticket-42" } },
      primary: true,
    },
    { id: "approve", label: "Approve", kind: "command", command: "pstdio.pstdio-planner.command.approve-proposal", params: { ticket: "PS-42" } },
  ],
});
```

Dedupe keys identify the producer's source condition. Planner uses keys such as
`pstdio-planner:ticket:PS-42:blocked`. Re-emitting the same live key updates the
existing row instead of creating duplicates. A dedupe key is not a command ID.

## Actions

Notification actions are structured so the dashboard and CLI can run them safely:

- `navigate` opens an explicit page or panel target. The resource alone does not choose a destination.
- `command` runs a command by its fully qualified ID with JSON params.
- `url` opens an external link.

Mark the preferred action with `primary: true`. For blocked agent flows, make the primary action open the waiting session so the user can reply.

## Set an item's status

Mark a completed condition as `done`. Use `dismissed` to remove an item without claiming its work is complete.

```ts
const notification = await ctx.notify.setStatus("notification-id", "done");
const group = await ctx.notify.setStatusByKey("pstdio-planner:ticket:PS-42:blocked", "dismissed");
```

The ID call returns `Notification | null`; the key call returns `Notification[]`. Both stay inside
the command's project. Repeating a status returns the current record without a write or event.
You can change `done` to `dismissed` and back. Reading or snoozing does not reopen a final item,
and host-expired items stay expired. Authors cannot set `expired`.

Webviews invoke a command that uses these methods. The `notification.action`, `.resolve` and
`.dismiss` bridge capabilities are deprecated. Toasts still use `notification.show`.

External clients use `client.notifications.setStatus(projectId, id, { status: "done" })` or
`setStatusByKey(projectId, key, { status: "dismissed" })`. HTTP accepts `read`, `done`, `dismissed`
and `{ status: "snoozed", snoozedUntil: "2026-12-01T12:00:00.000Z" }` through
`POST /v1/projects/:projectId/notifications/:id/status` and
`POST /v1/projects/:projectId/notifications/status-by-key` (with `key` in the JSON body).
Snoozing requires a timestamp; other statuses reject a snooze timestamp.

`ctx.notify.resolve`, `ctx.notify.dismiss`, the old HTTP status routes and `PATCH snoozedUntil`
remain available but deprecated in 0.44. Use the methods above before their 0.45 removal.
Notification types come from `@pstdio/sdk/resources`.
