# TUI Spec: Settings Overlay

Manage project-level statuses and tags from the TUI. Opened with `S` from any tab.

## Layout

The overlay has two sections, switched with `Tab`/`Shift+Tab`:

1. **Statuses** (default)
2. **Tags**

```
┌─ Settings: Statuses ──────────────────────────────────┐
│  pstdio │ my-project                                   │
│  Settings │ ▸ Statuses │ Tags                          │
│────────────────────────────────────────────────────────│
│  backlog    gray    *                                  │
│  ready      teal                                       │
│  wip        blue                                       │
│  blocked    red                                        │
│  review     amber                                      │
│  done       green                                      │
│                                                        │
│────────────────────────────────────────────────────────│
│ n:new  c:color  d:default  x:delete  Esc:back          │
└────────────────────────────────────────────────────────┘

┌─ Settings: Tags ──────────────────────────────────────┐
│  pstdio │ my-project                                   │
│  Settings │ Statuses │ ▸ Tags                          │
│────────────────────────────────────────────────────────│
│  bug             red                                   │
│  feature         blue                                  │
│  documentation   purple                                │
│                                                        │
│────────────────────────────────────────────────────────│
│ n:new  c:color  x:delete  Esc:back                     │
└────────────────────────────────────────────────────────┘
```

---

## Opening / Closing

| Key   | Action                                          |
| ----- | ----------------------------------------------- |
| `S`   | Open settings overlay (from any tab)            |
| `Esc` | Close overlay, return to previous tab and state |

Opening preserves the active tab and its state. Closing restores them.

---

## Section Switching

| Key         | Action                   |
| ----------- | ------------------------ |
| `Tab`       | Next section (wraps)     |
| `Shift+Tab` | Previous section (wraps) |

Each section preserves its own selection state when switching.

---

## Statuses Section

### Columns

| Column  | Width    | Content                            |
| ------- | -------- | ---------------------------------- |
| Name    | 14 chars | Status name                        |
| Color   | 8 chars  | Color name (rendered in its color) |
| Default | 1 char   | `*` if project default             |

Sorted by `sort_order`.

### Navigation

| Key | Action        |
| --- | ------------- |
| `g` | Jump to first |
| `G` | Jump to last  |

### Actions

| Key | Action                          |
| --- | ------------------------------- |
| `n` | Create new status               |
| `c` | Change color of selected status |
| `d` | Set selected as default         |
| `x` | Delete selected status          |

---

## Tags Section

### Columns

| Column | Width    | Content                            |
| ------ | -------- | ---------------------------------- |
| Name   | 14 chars | Tag name                           |
| Color  | 8 chars  | Color name (rendered in its color) |

Sorted alphabetically by name.

### Navigation

Same as Statuses section.

### Actions

| Key | Action                       |
| --- | ---------------------------- |
| `n` | Create new tag               |
| `c` | Change color of selected tag |
| `x` | Delete selected tag          |

---

## Actions Detail

### Create (`n`)

Multi-step inline flow:

1. **Name** — input bar with label "Name". `Enter` to confirm, `Esc` to cancel.
2. **Color** — color picker (see Color Picker below). `Enter` to confirm, `Esc` to cancel.

For statuses: calls `POST /statuses` with `{ name, color, projectId }`.
For tags: calls `POST /tags` with `{ name, color, projectId }`.

The new item appears in the list via SSE.

#### Errors

- **Duplicate name**: flash message `"Status already exists: <name>"` or `"Tag already exists: <name>"` in the status bar.

### Change Color (`c`)

Opens the color picker for the selected item. `Enter` to confirm, `Esc` to cancel.

For statuses: calls `PATCH /statuses/{id}` with `{ color }`.
For tags: calls `PATCH /tags/{id}` with `{ color }`.

### Set Default (`d`) — Statuses Only

Sets the selected status as the project default. Calls `PATCH /statuses/{id}` with `{ default: true }`. The `*` marker moves to the selected status.

### Delete (`x`)

Soft-deletes the selected item.

For statuses: calls `DELETE /statuses/{id}`.
For tags: calls `DELETE /tags/{id}`.

The item disappears from the list via SSE.

#### Constraints

- **Cannot delete the default status.** Flash message: `"Cannot delete the default status. Set a different default first."` The `d` key hint blinks once to draw attention.
- **Last item.** No constraint — a project can have zero custom statuses or tags (though this is unusual).

---

## Color Picker

A reusable inline picker for selecting a color. Shown below the selected row when triggered by `c` (change color) or during the create flow.

```
│  wip        blue                                       │
│  ┌─────────────────────────────────────────────┐       │
│  │ ● gray  ● red   ● orange  ● amber  ● yellow│       │
│  │ ● lime  ● green ● teal   ● cyan   ● blue  │       │
│  │ ● indigo ● violet ● purple ● pink  ● rose  │       │
│  └─────────────────────────────────────────────┘       │
│  blocked    red                                        │
```

Each color is rendered in its own color. Navigation: arrow keys. `Enter` to confirm, `Esc` to cancel.

---

## Data

Statuses fetched from the sync stream (`ticket_statuses` collection). Tags fetched from the sync stream (`ticket_tags` collection). Both filtered to the active project client-side.

---

## Hooks

| Hook           | Responsibility                                   |
| -------------- | ------------------------------------------------ |
| `use-statuses` | Fetch and cache statuses for the current project |
| `use-tags`     | Fetch and cache tags for the current project     |

Both accept project ID, return `{ items, loading, error }`. Re-fetch on project change. SSE events trigger optimistic list updates.

---

## Panels & Components

| File                        | Description                   |
| --------------------------- | ----------------------------- |
| `panels/settings.tsx`       | Settings overlay container    |
| `panels/status-list.tsx`    | Status list within settings   |
| `panels/tag-list.tsx`       | Tag list within settings      |
| `panels/color-picker.tsx`   | Inline color picker           |
| `components/status-row.tsx` | Single row in the status list |
| `components/tag-row.tsx`    | Single row in the tag list    |
