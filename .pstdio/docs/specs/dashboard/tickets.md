---
status: draft
---

# Tickets View

Browse, organize, and create project tickets in the dashboard. The tickets view is the primary work-tracking surface.

---

## Layout

```
+----------------------------------------------------------+
| Tickets                                    [Display]      |
+----------------------------------------------------------+
|                                                           |
|  Board view (default)                                     |
|  +----------+ +----------+ +----------+ +----------+     |
|  | backlog  | | wip      | | review   | | done     |     |
|  |----------| |----------| |----------| |----------|     |
|  | ticket 1 | | ticket 3 | |          | | ticket 5 |     |
|  | ticket 2 | |          | |          | |          |     |
|  |          | |          | |          | |          |     |
|  | [+ New]  | |          | |          | |          |     |
|  +----------+ +----------+ +----------+ +----------+     |
|                                                           |
+----------------------------------------------------------+
```

The header shows the page title and a **Display** button that opens the display settings menu. Below the header, the view renders either a board or a list depending on the active view mode.

---

## Routes

| Route                                                        | View                |
| ------------------------------------------------------------ | ------------------- |
| `/projects/:projectId/tickets`                               | Tickets list/board  |
| `/projects/:projectId/tickets/:ticketShorthand`              | Ticket detail page  |
| `/projects/:projectId/tickets/:ticketShorthand/workspaces/:workspaceShorthand` | Workspace page |

Clicking a ticket card navigates from the list/board to the ticket detail page.

---

## View Modes

The tickets view supports two view modes:

| Mode    | Description                                                                 |
| ------- | --------------------------------------------------------------------------- |
| `board` | Kanban-style columns. Each group is a column. Tickets can be dragged across columns. |
| `list`  | Flat list. All groups are flattened into a single scrollable list.           |

The default view mode is `board`.

---

## Display Settings

The **Display** button opens a popover with controls for customizing the view. Settings are session-scoped and reset on page reload.

### View

Toggle between `board` and `list`.

### Grouping

Controls how tickets are grouped into columns (board) or sections (list).

| Value        | Behavior                                                                 |
| ------------ | ------------------------------------------------------------------------ |
| `status`     | One group per project status, ordered by status sort order.              |
| `complexity` | Groups: `low`, `medium`, `high`, `unspecified`.                          |
| `assignee`   | One group per assignee (alphabetical), plus `Unassigned` at the end.     |
| `none`       | All tickets in a single group labeled "All Tickets".                     |

Default: `status`.

### Ordering

Controls the sort order of tickets within each group.

| Value        | Behavior                                    |
| ------------ | ------------------------------------------- |
| `manual`     | No reordering; tickets appear as returned.  |
| `updated`    | Most recently updated first.                |
| `title`      | Alphabetical by title.                      |
| `complexity` | High, medium, low, unspecified.             |
| `shorthand`  | Numeric sort by ticket ID (e.g. PS-1, PS-2).|

Default: `manual`.

### Display Properties

Controls which badges appear on each ticket card. Multiple values can be selected.

| Value       | Badge content                                         |
| ----------- | ----------------------------------------------------- |
| `parentId`  | Parent ticket shorthand (if the ticket has a parent). |
| `status`    | Status name with color.                               |
| `complexity`| Complexity level (if set).                            |
| `assignee`  | Assignee name (if set).                               |
| `tags`      | One badge per assigned tag, with tag color.           |
| `updatedAt` | Formatted update date.                                |

Default: `["complexity"]`.

---

## Ticket Cards

Each ticket is displayed as a card showing:

- **Shorthand** (e.g. `PS-12`)
- **Title** (falls back to "empty ticket" when blank)
- **Badges** based on the active display properties

Clicking a ticket card navigates to `/projects/:projectId/tickets/:ticketShorthand`.

---

## Board View

### Columns

When grouped by **status**, each column has permissions derived from the status:

| Permission          | Rule                                                         | Effect                                                       |
| ------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `canDragIn`         | Always `true`.                                               | Tickets can be dropped into this column.                     |
| `canDragOut`        | Always `true`.                                               | Tickets can be dragged out of this column.                   |
| `canCreate`         | `true` when the status is the project default.               | A "+" button appears in the column header.                   |
| `canAttemptOnDrop`  | `true` when the status name contains "wip" or "progress".   | Dropping a ticket here automatically starts an agent attempt.|

When grouped by other fields, drag-and-drop and creation are disabled.

### Column Actions

Columns may expose actions in a context menu. Actions are derived from the status name:

| Action         | Rule                                                          | Behavior                                     |
| -------------- | ------------------------------------------------------------- | -------------------------------------------- |
| `archive_all`  | Status name is "done", "closed", or "archived".              | Archives every ticket in the column.         |

### Drag and Drop

Dragging a ticket from one column to another updates the ticket's status to the target column's status. The status update uses optimistic updates with rollback on failure.

When the target status has `canAttemptOnDrop` set, or its name contains "wip" or "progress", an agent attempt is automatically created for the ticket using the ticket content (or title as fallback) as the prompt.

---

## List View

All groups are flattened into a single list. Each row shows the ticket shorthand, title, badges, and the formatted update date. Clicking a row navigates to the ticket detail page.

---

## Creating Tickets

The **"+ New"** button at the bottom of a board column (when the column allows creation) opens a modal dialog.

### Create Ticket Modal

| Field       | Type       | Required | Default      | Description                         |
| ----------- | ---------- | -------- | ------------ | ----------------------------------- |
| Title       | text input | yes      | —            | The ticket title. Auto-focused.     |
| Complexity  | dropdown   | no       | `medium`     | `low`, `medium`, or `high`.         |
| Template    | dropdown   | no       | no template  | Available project ticket templates. Only shown when templates exist. |

- Pressing **Enter** in the title field submits the form.
- The modal resets all fields when closed.
- The target status is pre-filled based on which column's "New" button was clicked, or defaults to the first status with `canCreate` enabled.
- The ticket content is set to the title value.

---

## Filtering

Archived tickets are excluded from the view. There is no user-facing filter control.

---

## Data

The tickets view fetches:

- **Project** — status options, tags, and repositories.
- **Tickets** — all tickets for the project (archived tickets are filtered client-side).
- **Template assets** — ticket templates filtered to `ticket-template` type.

A loading state ("Loading tickets...") is shown while data is being fetched.

---

## Mutations

All mutations use optimistic updates with rollback on error.

| Action              | Behavior                                                              |
| ------------------- | --------------------------------------------------------------------- |
| Move ticket         | Updates status. Optionally creates an agent attempt.                  |
| Create ticket       | Creates ticket with title, content, complexity, status, and parentId. |
| Archive all         | Archives every ticket in a column via individual update calls.        |
| Update ticket       | Updates title, content, complexity, or archived flag.                 |
| Delete ticket       | Soft-deletes a ticket.                                                |
| Update ticket tags  | Replaces tag assignments on a ticket.                                 |
| Create/update/delete tag | Manages project-level tag definitions.                           |
