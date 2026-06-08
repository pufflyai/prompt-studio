---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# CLI Statuses

Ticket statuses are planner extension data. The core backend no longer stores
`ticket_statuses`, and status management commands are planner command aliases.

## Purpose

Manage the workflow states used by planner tickets and the ticket board.
Statuses are project-scoped through the planner extension.

## Default Statuses

| Name          | Color   | Default |
| ------------- | ------- | ------- |
| `Backlog`     | `gray`  | yes     |
| `Ready`       | `teal`  | no      |
| `In Progress` | `blue`  | no      |
| `Blocked`     | `red`   | no      |
| `In Review`   | `amber` | no      |
| `Done`        | `green` | no      |

## Commands

Status commands resolve the current project from `.pstdio/config.json` unless a
project id flag is provided by the router.

```sh
pst statuses list
pst statuses create --name "Triaging" --color amber
pst statuses set-default --name "Ready"
pst statuses delete --name "Triaging"
```

The commands execute planner extension commands such as
`pstdio-planner.ticketStatus.read` and
`pstdio-planner.ticketStatus.setDefault`.

## Automation

Planner workspace automation can update ticket statuses:

1. Starting a ticket attempt moves the ticket to `In Progress`.
2. When all linked active workspaces are marked `reviewed`, the ticket moves to
   `In Review`.

Implementation automation is extension-owned. The core API does not expose a
status transition endpoint for planner tickets.

## Colors

The `--color` flag accepts:

`gray`, `red`, `orange`, `amber`, `yellow`, `lime`, `green`, `teal`, `cyan`,
`blue`, `indigo`, `violet`, `purple`, `pink`, `rose`.
