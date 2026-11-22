# Notifications

Know when work finishes or needs your attention.

## What notifications give you

Prompt Studio tells you about work in three places, depending on what happened:

- **The resource itself.** Progress and success show on the item that changed. For example, a session's status says when the agent finished, and a dot marks a session with a new reply or question since you last looked.
- **The status bar.** App-wide information and errors appear there.
- **The inbox.** Notifications are pending work that a person or an agent still needs to resolve, such as a review, an approval, or a blocked agent.

Each notification belongs to one project. It has a title, a priority, the resource it is about, and actions such as **Reply to agent** or **Approve**. The tool that sent it marks it done when the work is resolved. For example, Planner sends **Needs input** when an agent on a ticket waits for your answer, and **Review proposal** when a proposal ticket is ready for review.

## Use notifications in Prompt Studio

The inbox starts off in the dashboard. Turn it on in **Settings → Experimental → Beta features → Notifications**. The switch applies to every project. Tools can create notifications while it is off, and the CLI still lists them.

With the inbox on, the sidebar shows **Notifications** with a count of pending items. Choose it, press **Alt+Shift+N**, or run **Open notifications** from search. Run a notification's action to open the waiting session or ticket, or dismiss it.

From the terminal, run these inside the project folder:

```sh
pst inbox
pst notifications list --status <status> --priority <priority>
pst notifications done <id>
pst notifications snooze <id> --until 1h
```

`pst notifications send` creates a notification, for example from a script. Sending again with the same `--dedupe-key` updates the existing notification instead of adding a second one.

## Send notifications from your tool

A tool creates or updates an inbox item with `ctx.notify.action(...)`. Give it a `title`, a `kind` such as `needs_review` or `blocked`, a `priority`, the `target` resource, and a stable `dedupeKey`. Its `actions` are structured: `navigate` opens a page or panel, `command` runs a command with parameters, and `url` opens a link. Mark the preferred one with `primary: true`.

When the condition is resolved, call `ctx.notify.setStatus(id, "done")` or `ctx.notify.setStatusByKey(key, "done")`. Use `"dismissed"` to remove an item without saying its work is complete.

Use notifications only for actionable work. Record history with `ctx.activity.record(...)`, and show system notices in the status bar with the `notification.show` webview capability. To react when an agent finishes, a tool can add a hook on `sessionEvents.completed`. See [Hooks](0005-hooks.md).

## Learn more

- [Notifications for extensions](../../references/extensions/0011-notifications.md) explains surfaces, dedupe keys, actions, and statuses.
- [CLI notifications](../../references/cli/0008-notifications.md) lists every `pst notifications` command and option.
- [Planner in the dashboard](../../../extensions/pstdio-planner/docs/0003-dashboard.md#notifications) shows the notifications Planner sends.

*Updated at: 2026-11-22*
