# TUI Spec: Tickets Tab

Browse, filter, create, and act on tickets from the TUI. This is the first (leftmost) tab.

## Layout

Three panels, one visible at a time:

1. **List panel** — tickets in a scrollable, expandable tree (default)
2. **Content panel** — single ticket detail (opened with `Enter`, closed with `Esc`)
3. **Edit panel** — tabbed editor for ticket content and metadata (opened with `e`, closed with `Esc`)

```
┌─ List panel ───────────────────────────────────────────┐
│  pstdio │ my-project                                   │
│  ▸ Tickets │ Docs │ Templates                          │
│────────────────────────────────────────────────────────│
│  ── wip ──────────────────────────────────────────     │
│  PS-14  Add dark mode                                  │
│  ── backlog ──────────────────────────────────────     │
│  PS-13  Fix login bug                                  │
│  ▸ PS-12  Refactor auth                                │
│  ── done ─────────────────────────────────────────     │
│  PS-11  Setup CI pipeline                              │
│                                                        │
│────────────────────────────────────────────────────────│
│ n:new  e:edit  i:impl  x:arch  ?:help                    │
└────────────────────────────────────────────────────────┘

┌─ List panel (PS-12 expanded) ──────────────────────────┐
│  pstdio │ my-project                                   │
│  ▸ Tickets │ Docs │ Templates                          │
│────────────────────────────────────────────────────────│
│  ── backlog ──────────────────────────────────────     │
│  PS-13  Fix login bug                                  │
│  ▾ PS-12  Refactor auth                                │
│      PS-15  Extract token logic                        │
│      PS-16  Update middleware                          │
│                                                        │
│────────────────────────────────────────────────────────│
│ n:new  e:edit  i:impl  x:arch  ?:help                    │
└────────────────────────────────────────────────────────┘

┌─ Content panel (Enter on PS-13) ───────────────────────┐
│  pstdio │ my-project                                   │
│  ▸ Tickets │ Docs │ Templates                          │
│────────────────────────────────────────────────────────│
│  PS-13 │ Fix login bug │ backlog │ bug                 │
│  Priority: P2  Complexity: low                         │
│────────────────────────────────────────────────────────│
│  ## Description                                        │
│  The login page throws a 500 error when…               │
│                                                        │
│────────────────────────────────────────────────────────│
│ Esc:back  e:edit  i:implement  x:archive  ?:help       │
└────────────────────────────────────────────────────────┘

┌─ Edit panel: Content tab ─────────────────────────────┐
│  pstdio │ my-project                                   │
│  PS-13 │ ▸ Content │ Status │ Tags                     │
│────────────────────────────────────────────────────────│
│  # Fix login bug                                       │
│                                                        │
│  ## Description                                        │
│  The login page throws a 500 error when…               │
│  █                                                     │
│                                                        │
│────────────────────────────────────────────────────────│
│ Tab:section  Esc:back  Ctrl+S:save                     │
└────────────────────────────────────────────────────────┘

┌─ Edit panel: Status tab ──────────────────────────────┐
│  pstdio │ my-project                                   │
│  PS-13 │ Content │ ▸ Status │ Tags                     │
│────────────────────────────────────────────────────────│
│    backlog    gray                                     │
│    ready      teal                                     │
│  ▸ wip        blue                                     │
│    blocked    red                                      │
│    review     amber                                    │
│    done       green                                    │
│                                                        │
│────────────────────────────────────────────────────────│
│ Tab:section  Enter:select  Esc:back                     │
└────────────────────────────────────────────────────────┘

┌─ Edit panel: Tags tab ────────────────────────────────┐
│  pstdio │ my-project                                   │
│  PS-13 │ Content │ Status │ ▸ Tags                     │
│────────────────────────────────────────────────────────│
│  ✓ bug             red                                 │
│    feature         blue                                │
│    documentation   purple                              │
│                                                        │
│────────────────────────────────────────────────────────│
│ Tab:section  Space:toggle  Esc:back                     │
└────────────────────────────────────────────────────────┘
```

---

## List Panel

### Sorting

Tickets are grouped by status. Each status group has a dimmed section header:

```
── wip ──────────────────────────────────
```

Groups are ordered by `ticket_statuses.sort_order`. Within each group, tickets are sorted by `created_at` descending (newest first).

Drafts and archived tickets are hidden by default (see Filtering).

### Tree Structure

The list is a tree. Top-level tickets (no `parent_id`) appear at root level. Tickets with children show a `▸`/`▾` expand marker. Pressing `Enter` on a parent ticket toggles its children. Pressing `Enter` on a leaf ticket (or an already-expanded parent) opens the content panel.

Children are indented by 4 spaces. They appear directly below their parent, inside the parent's status group.

| Row state              | Marker | `Enter` behavior         |
| ---------------------- | ------ | ------------------------ |
| Parent, collapsed      | `▸`    | Expand children          |
| Parent, expanded       | `▾`    | Open content panel       |
| Leaf (no children)     | none   | Open content panel       |
| Child ticket           | none   | Open content panel       |

Nesting is one level deep — a child ticket does not expand further even if it has its own children.

### Columns

| Column    | Width    | Content                                   |
| --------- | -------- | ----------------------------------------- |
| Marker    | 2 chars  | `▸`, `▾`, or empty                        |
| Shorthand | 10 chars | `PS-14` (dimmed if draft)                 |
| Title     | flex     | Truncated to fit                          |

Status is conveyed by the group header, not repeated per row.

### Navigation

| Key         | Action                            |
| ----------- | --------------------------------- |
| `g`         | Jump to first ticket              |
| `G`         | Jump to last ticket               |
| `Enter`     | Expand/collapse or open content   |
| `Tab`       | Next tab (Docs)                   |
| `Shift+Tab` | Previous tab (Templates, wraps)   |
| `q`         | Quit TUI                          |

Status group headers are not selectable — arrow keys skip over them.

### Filtering

| Key | Action                                                         |
| --- | -------------------------------------------------------------- |
| `/` | Open input bar — matches against shorthand, title, and tags    |
| `s` | Cycle status filter: `all → backlog → wip → in_review → done → archived` |

Active filters show below the tab bar:

```
 5 tickets │ status: wip │ filter: login
```

Filtering applies to both parents and children. If a child matches, its parent is shown (collapsed). If a parent matches, it is shown without auto-expanding.

The `archived` step in the status cycle shows only archived tickets. All other steps hide archived tickets.

### Actions (List)

| Key | Action                                     |
| --- | ------------------------------------------ |
| `n` | New ticket (opens create flow)             |
| `e` | Open edit panel for selected ticket        |
| `i` | Implement selected ticket (launches agent) |
| `x` | Toggle archive on selected ticket          |

---

## Content Panel

Full-screen view of a single ticket. Opened with `Enter` from the list, closed with `Esc`.

### Layout

1. **Header line** — shorthand, title, status badge, tags
2. **Metadata line** — priority, complexity, parent (if child ticket)
3. **Separator**
4. **Body** — ticket markdown rendered with `ink-markdown`, scrollable

### Navigation

| Key        | Action                     |
| ---------- | -------------------------- |
| `g`        | Scroll to top              |
| `G`        | Scroll to bottom           |
| `Esc`      | Back to list panel         |

### Actions (Content)

| Key | Action                            |
| --- | --------------------------------- |
| `e` | Open edit panel                   |
| `i` | Implement ticket (launches agent) |
| `x` | Toggle archive                    |

---

## Actions Detail

### Create Ticket (`n`)

Multi-step inline flow (list panel only):

1. **Title** — input bar with label "Title"
2. **Template** — picker showing ticket templates (from `GET /templates?type=ticket`). Skip with `Enter` on "None".
3. **Tags** — multi-select from existing tags. Skip with `Enter`.

If `n` is pressed while a parent ticket is selected, the new ticket is created as a child (`parent_id` set automatically). Otherwise it is created at top level.

Calls `POST /tickets`. If a template was selected, calls `POST /templates/write` targeting the new shorthand.

### Edit Panel (`e`)

Full-screen panel with three tabs for editing a ticket. Opened with `e` from either the list or content panel. Closed with `Esc` (returns to the panel you came from).

#### Header

```
PS-13 │ ▸ Content │ Status │ Tags
```

Shows the ticket shorthand and tab bar. `▸` marks the active tab.

#### Tab Switching

| Key         | Action               |
| ----------- | -------------------- |
| `Tab`       | Next tab (wraps)     |
| `Shift+Tab` | Previous tab (wraps) |

Each tab preserves its own state when switching.

#### Content Tab

Inline text editor for the ticket markdown. The full ticket body is editable directly in the TUI.

| Key       | Action                              |
| --------- | ----------------------------------- |
| Arrow keys| Move cursor                         |
| Type      | Insert text at cursor               |
| Backspace | Delete character before cursor      |
| `Ctrl+S`  | Save changes                        |
| `Esc`     | Back (prompts to save if unsaved)   |

On save, calls `PATCH /tickets/{id}` with the updated content. If unchanged, no API call is made.

#### Status Tab

Picker listing all statuses for the project. The current status is marked with `▸`.

| Key       | Action                               |
| --------- | ------------------------------------ |
| `Enter`   | Set status and return to Content tab |

On select, calls `PATCH /tickets/{id}` with the new status. The ticket moves to the new status group in the list panel.

#### Tags Tab

Multi-select list of all tags for the project. Assigned tags show a `✓` marker.

| Key       | Action            |
| --------- | ----------------- |
| `Space`   | Toggle tag on/off |

Changes are applied immediately — each toggle calls `PATCH /tickets/{id}` with the updated tag list. No explicit save step needed.

### Implement Ticket (`i`)

1. Calls `PATCH /tickets/{id}` with `status=wip`.
2. Exits the TUI and launches the configured agent (same as `pstdio tickets implement --id <shorthand>`).

If no agent is configured: `"No agent configured. Press 'a' to set up an agent."`

### Archive / Unarchive (`x`)

Toggles the `archived` flag on the selected ticket. Calls `PATCH /tickets/{id}` with `archived=true` (or `false` if already archived). Available from both list and content panels.

When archiving from the list panel, the ticket disappears from the current view (unless the status filter is set to `archived`). When unarchiving from the `archived` filter view, the ticket disappears and reappears under its status group.

---

## Data

Fetched via `GET /tickets` for the current project. The list updates in real time via SSE `sync:set` and `sync:delete` events on the `tickets` collection.

The hook groups tickets by `parent_id` to build the tree, then by `status_id` to build the status groups. Top-level items have `parent_id = null`.

---

## Hook

| Hook          | Responsibility                                           |
| ------------- | -------------------------------------------------------- |
| `use-tickets` | Fetch, filter, and cache tickets for the current project |

Accepts project ID, returns `{ items, loading, error }`. Re-fetches on project change. SSE events trigger optimistic list updates. Exposes `getChildren(ticketId)` for tree expansion.

---

## Panels & Components

| File                          | Description                        |
| ----------------------------- | ---------------------------------- |
| `panels/ticket-list.tsx`      | Ticket list panel (tree)           |
| `panels/ticket-content.tsx`   | Single ticket content panel        |
| `panels/ticket-edit.tsx`      | Edit panel container with tabs     |
| `panels/ticket-edit-body.tsx` | Inline text editor for content tab |
| `panels/status-picker.tsx`    | Status picker for status tab       |
| `panels/tag-picker.tsx`       | Multi-select tag list for tags tab |
| `panels/ticket-create.tsx`    | Multi-step inline ticket creation  |
| `components/ticket-item.tsx`  | Single row in the ticket list      |
| `components/status-badge.tsx` | Colored inline status label        |
| `components/status-group.tsx` | Dimmed section header for a group  |
