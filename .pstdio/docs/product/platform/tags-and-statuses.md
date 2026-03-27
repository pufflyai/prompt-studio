# Tags & Statuses — Product Requirements

## Overview

Tags and statuses are the two core metadata systems for organizing and categorizing tickets in pstdio. Together they provide a flexible, project-level customization layer that replaces hardcoded fields.

---

## Statuses

Statuses represent the workflow states a ticket moves through. Each project has its own set of statuses.

### Data Model

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| project_id | string | Parent project |
| name | string | Display name (e.g., "backlog", "wip", "done") |
| color | string | A valid color palette name |
| sort_order | integer | Display ordering |
| is_default | boolean | Whether this is the default status for new tickets |
| can_create | boolean | Whether tickets can be created directly into this status |
| can_drag_in | boolean | Whether tickets can be dragged into this column |
| can_drag_out | boolean | Whether tickets can be dragged out of this column |
| column_actions | string[] | Actions available on the column header (e.g., "archive_all") |

### Default Statuses

Every new project is seeded with 6 statuses:

| Name | Color | Default | can_create | can_drag_in | can_drag_out | column_actions | Notes |
|------|-------|---------|-----------|-------------|--------------|----------------|-------|
| backlog | gray | Yes | true | true | true | — | Default status for new tickets, only creatable column |
| ready | green | No | false | true | true | — | Tickets ready to be worked on |
| wip | blue | No | false | true | false | — | Work in progress; drag out is disabled |
| blocked | red | No | false | true | true | — | Blocked tickets |
| review | amber | No | false | true | true | — | Tickets in review |
| done | green | No | false | true | true | archive_all | Completed tickets; supports bulk archive |

### Status Management

- Managed in **Project Settings → Statuses** panel
- Changes to status name, color, actions, ordering, and default are held in a **draft state**
- A **Save** button persists all changes at once
- A **Cancel** button discards all pending changes
- Save and Cancel are disabled when no changes have been made
- Statuses can be reordered via drag-and-drop
- Each status has configurable actions (create, drag in/out, archive)
- One status must be marked as default
- Deleting a status requires confirmation, then is staged in the draft until saved
- The default status cannot be deleted
- New statuses added via inline form default to `can_drag_in: true`, `can_drag_out: true`

### Status API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/projects/:id/statuses` | List all statuses |
| POST | `/v1/projects/:id/statuses` | Create a new status |
| PATCH | `/v1/projects/:id/statuses/:statusId` | Update a status (name, color, sort_order, actions) |
| PATCH | `/v1/projects/:id/statuses/:statusId/set-default` | Set a status as the default |
| DELETE | `/v1/projects/:id/statuses/:statusId` | Soft-delete a status |

---

## Tags

Tags are flexible, project-level metadata fields that can be attached to tickets. Each tag defines a set of named options, and tickets reference those options.

### Tag Types

| Type | Behavior |
|------|----------|
| `single_select` | Only one option from this tag can be selected per ticket |
| `multi_select` | Multiple options from this tag can be selected per ticket |

### Data Model

#### Tag Definition

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| project_id | string | Parent project |
| name | string | Tag name (e.g., "label", "complexity", "priority") |
| type | enum | `single_select` or `multi_select` |

#### Tag Option

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| tag_id | string | Parent tag definition |
| name | string | Option name (e.g., "bug", "feature", "high") |
| color | string | A valid color palette name |
| icon | string? | Lucide icon name (e.g., "bug", "sparkles"). Defaults to "circle" when unset |
| description | string? | Optional description shown as tooltip in selection dropdowns |
| sort_order | integer | Display ordering within the tag |

#### Tag Assignment

| Field | Type | Description |
|-------|------|-------------|
| ticket_id | string | The ticket |
| ticket_tag_option_id | string | The selected option |

### Default Tags

Every new project is seeded with 3 tags:

#### "label" (single_select)

| Option | Color | Icon |
|--------|-------|------|
| bug | red | bug |
| feature | blue | sparkles |
| documentation | purple | book-open |
| chore | gray | wrench |

#### "complexity" (single_select)

| Option | Color | Icon |
|--------|-------|------|
| low | green | gauge |
| medium | orange | gauge |
| high | red | gauge |

#### "priority" (single_select)

| Option | Color | Icon |
|--------|-------|------|
| P1 | red | alert-triangle |
| P2 | orange | alert-triangle |
| P3 | yellow | alert-triangle |

### Tag Management (Project Settings)

Tags are managed in **Project Settings → Tags** in the sidebar.

#### Creating Tags
- Click the "+" button next to the Tags section in the sidebar
- A new tag named "new tag" is created with type "single_select"
- The tag editor opens automatically

#### Editing Tags
- Changes to tag name, type, and options are held in a **draft state**
- A **Save** button persists all changes at once
- A **Cancel** button discards all pending changes
- The Save button is disabled when no changes have been made

#### Tag Options Table
- Each option row shows: drag handle, icon+color picker, name (editable), description (editable), delete button
- Options can be reordered via drag-and-drop
- New options are added via an inline form at the bottom
- The icon+color picker is a combined popover

#### Deleting Tags
- Delete is only available from the tag editor panel (not from the sidebar)
- A confirmation modal warns that the tag will be removed from all tickets
- Deletion is a soft-delete

### Tag Selection (Tickets)

Tags appear in two places for ticket editing:

#### Create Ticket Modal
- Each tag renders as its own dropdown button in the modal footer
- Single-select tags replace the previous selection
- Multi-select tags toggle options independently
- Each option shows its icon (from the Lucide icon set) in the option's color
- When a single option is selected, the trigger button shows that option's icon
- Options with a description show it as a tooltip on hover

#### Ticket Properties Panel
- Tag names are capitalized in the properties panel
- Each tag renders as its own labeled dropdown
- Shows current selection(s) for the ticket
- Supports the same single/multi-select behavior
- Each option shows its icon in the option's color
- Options with a description show it as a tooltip on hover

### Tag API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/projects/:id/ticket-tags` | List all tags with options |
| POST | `/v1/projects/:id/ticket-tags` | Create a new tag |
| PUT | `/v1/projects/:id/ticket-tags/:tagId` | Update tag name/type |
| DELETE | `/v1/projects/:id/ticket-tags/:tagId` | Soft-delete a tag |
| POST | `/v1/projects/:id/ticket-tags/:tagId/options` | Add an option |
| PUT | `/v1/projects/:id/ticket-tags/:tagId/options/:optId` | Update an option |
| DELETE | `/v1/projects/:id/ticket-tags/:tagId/options/:optId` | Delete an option |

### CLI Commands

```bash
# List all tags for the current project
pstdio tags list

# Create a new tag
pstdio tags create --name "priority" --type "single_select"
```

---

## Color Palette

Both statuses and tag options share the same color palette:

| Name | Usage |
|------|-------|
| gray | Default/neutral |
| red | Errors, bugs, high severity |
| orange | Warnings, medium severity |
| amber | Review, attention |
| yellow | Caution |
| lime | Positive/growth |
| green | Success, ready, low severity |
| teal | Information |
| cyan | Secondary |
| blue | Features, primary |
| indigo | Accent |
| violet | Accent |
| purple | Documentation |
| pink | Special |
| rose | Highlight |

---

## Real-Time Sync

All tag and status changes propagate in real-time via the event bus:

- `ticket_tags` → set/delete events for tag definitions
- `ticket_tag_options` → set/delete events for options
- `ticket_tag_assignments` → set/delete events for ticket-option links
- `ticket_statuses` → set/delete events for status definitions

The dashboard receives these events through SSE and updates the UI via synced collections (TanStack React DB).
