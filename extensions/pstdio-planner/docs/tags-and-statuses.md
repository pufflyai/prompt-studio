# Ticket Tags & Statuses

Ticket tags and ticket statuses are owned by the `pstdio-planner` extension.
They organize planner tickets, but they are not core API tables and they are not
exposed as `/v1/projects/:id/statuses` or `/v1/projects/:id/ticket-tags`
endpoints.

Core pstdio owns projects, repos, workspaces, sessions, skills,
agents, files, and extension runtime state. Templates are extension contributions.
Planner stores ticket workflow data
in extension storage and exposes it through planner commands.

## Statuses

Statuses represent ticket workflow states. Each project gets a planner-scoped
set of statuses.

Default statuses:

| Name        | Color | Default | Notes                                  |
| ----------- | ----- | ------- | -------------------------------------- |
| Backlog     | gray  | yes     | Default status for new tickets         |
| Todo        | purple | no     | Ready to be worked on                  |
| In Progress | blue  | no      | Agent/user work is active              |
| Blocked     | red   | no      | Waiting on an external dependency      |
| In Review   | yellow | no     | Workspace review is active or complete |
| Done        | green | no      | Completed work                         |

Planner automation updates statuses during ticket workflows:

Planner derives ticket status from its managed attempts. Active implementation
moves a ticket to `In Progress`; submitted revisions and review work contribute
to `In Review`. Workspace records do not store review statuses. See
[managed attempts](attempts.md) for precedence and the `Review Needed` handoff.

## Tags

Tags are planner-scoped metadata fields for categorizing tickets. Tags can be
single-select or multi-select and contain ordered options with color/icon
metadata.

Default tags:

| Tag Name     | Type            | Options                                    |
| ------------ | --------------- | ------------------------------------------ |
| `Type`       | `single_select` | `Bug`, `Feature`, `Chore` |
| `Complexity` | `single_select` | `Simple`, `Moderate`, `Complex` |
| `Priority`   | `single_select` | `Low`, `Medium`, `High`, `Urgent` |
| `Flags`      | `multi_select` | `Review Needed` |

## Management

The dashboard Project Settings panels for ticket statuses and ticket tags call
planner extension commands:

- `pstdio.pstdio-planner.command.ticket-status.read`
- `pstdio.pstdio-planner.command.ticket-status.create`
- `pstdio.pstdio-planner.command.ticket-status.update`
- `pstdio.pstdio-planner.command.ticket-status.delete`
- `pstdio.pstdio-planner.command.ticket-status.set-default`
- `pstdio.pstdio-planner.command.ticket-status.reorder`
- `pstdio.pstdio-planner.command.ticket-tag.read`
- `pstdio.pstdio-planner.command.ticket-tag.create`
- `pstdio.pstdio-planner.command.ticket-tag.update`
- `pstdio.pstdio-planner.command.ticket-tag.delete`
- `pstdio.pstdio-planner.command.ticket-tag.create-option`
- `pstdio.pstdio-planner.command.ticket-tag.update-option`
- `pstdio.pstdio-planner.command.ticket-tag.delete-option`

The CLI aliases for tickets route through the same planner command runtime.

## Sync

Planner ticket metadata is not part of core table sync. Dashboard views load and
mutate it through planner commands, then refresh planner-backed queries. Core
SSE sync still covers host rows such as workspaces and sessions; planner ticket
views combine those synced host rows with planner command data when displaying
attempts and review state.

## Color Palette

Ticket statuses and tag options use the shared product color palette:

`gray`, `red`, `orange`, `amber`, `yellow`, `lime`, `green`, `teal`, `cyan`,
`blue`, `indigo`, `violet`, `purple`, `pink`, `rose`.
