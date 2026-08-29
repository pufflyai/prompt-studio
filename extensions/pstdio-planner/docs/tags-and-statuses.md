# Ticket Tags & Statuses

Ticket tags and ticket statuses are owned by the `pstdio-planner` extension.
They organize planner tickets, but they are not core API tables and they are not
exposed as `/v1/projects/:id/statuses` or `/v1/projects/:id/ticket-tags`
endpoints.

Core pstdio still owns projects, repos, workspaces, sessions, templates, skills,
agents, files, and extension runtime state. Planner stores ticket workflow data
in extension storage and exposes it through planner commands.

## Statuses

Statuses represent ticket workflow states. Each project gets a planner-scoped
set of statuses.

Default statuses:

| Name        | Color | Default | Notes                                  |
| ----------- | ----- | ------- | -------------------------------------- |
| Backlog     | gray  | yes     | Default status for new tickets         |
| Ready       | teal  | no      | Ready to be worked on                  |
| In Progress | blue  | no      | Agent/user work is active              |
| Blocked     | red   | no      | Waiting on an external dependency      |
| In Review   | amber | no      | Workspace review is active or complete |
| Done        | green | no      | Completed work                         |

Planner automation updates statuses during ticket workflows:

1. Starting an implementation session moves the ticket to `In Progress`.
2. Marking a workspace `review-ready` starts a review session.
3. Marking all linked active workspaces `reviewed` moves the ticket to
   `In Review`.

## Tags

Tags are planner-scoped metadata fields for categorizing tickets. Tags can be
single-select or multi-select and contain ordered options with color/icon
metadata.

Default tags:

| Tag Name     | Type            | Options                                    |
| ------------ | --------------- | ------------------------------------------ |
| `label`      | `single_select` | `bug`, `feature`, `documentation`, `chore` |
| `complexity` | `single_select` | `low`, `medium`, `high`                    |
| `priority`   | `single_select` | `P1`, `P2`, `P3`                           |

## Management

The dashboard Project Settings panels for ticket statuses and ticket tags call
planner extension commands:

- `pstdio-planner.ticket-status.read`
- `pstdio-planner.ticket-status.create`
- `pstdio-planner.ticket-status.update`
- `pstdio-planner.ticket-status.delete`
- `pstdio-planner.ticket-status.set-default`
- `pstdio-planner.ticket-status.reorder`
- `pstdio-planner.ticket-tag.read`
- `pstdio-planner.ticket-tag.create`
- `pstdio-planner.ticket-tag.update`
- `pstdio-planner.ticket-tag.delete`
- `pstdio-planner.ticket-tag.create-option`
- `pstdio-planner.ticket-tag.update-option`
- `pstdio-planner.ticket-tag.delete-option`

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
