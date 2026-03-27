---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# Product Requirements Document: CLI Tags

## Summary

Tags are typed field definitions that can be assigned to tickets for structured categorization. Each tag has a name, a type (`single_select` or `multi_select`), and a list of value options. Options have a name and a color.

## Project Settings Placement

- Tags are managed in Project Settings under **Tags**.
- Each tag definition appears as a navigable sidebar item.
- Users can create new tag definitions, set their type, and manage options (create, edit, delete).
- Removing a tag definition soft-deletes it, preserving historical auditability.

---

## Default Tags

Projects are initialized with the following tag definitions:

| Tag Name     | Type            | Options                                                        |
| ------------ | --------------- | -------------------------------------------------------------- |
| `label`      | `single_select` | `bug` (red), `feature` (blue), `documentation` (purple), `chore` (gray) |
| `complexity` | `single_select` | `low` (green), `medium` (orange), `high` (red) |
| `priority`   | `single_select` | `P1` (red), `P2` (orange), `P3` (yellow) |

---

## Available Colors

The `--color` flag on options accepts one of the following values:

`gray`, `red`, `orange`, `amber`, `yellow`, `lime`, `green`, `teal`, `cyan`, `blue`, `indigo`, `violet`, `purple`, `pink`, `rose`

Using a value not in this list is an error.

---

## `pstdio tags create`

### Usage

```sh
pstdio tags create --name <name> [--type <type>] [--project-id <project-id>]
```

### Flags

| Flag           | Type     | Required | Default          | Description                                                                 |
| -------------- | -------- | -------- | ---------------- | --------------------------------------------------------------------------- |
| `--name`       | `string` | yes      |                  | Tag definition name. Must be unique within the project.                     |
| `--type`       | `string` | no       | `single_select`  | Tag type: `single_select` or `multi_select`.                                |
| `--project-id` | `string` | no       |                  | Target project. Defaults to the current project from `.pstdio/config.json`. |

### Behavior

1. Resolve the project: use `--project-id` if provided, otherwise fall back to `.pstdio/config.json`.
2. Create the tag definition in the database, associated with the project.

### Output

```text
Created tag "priority"
```

---

## `pstdio tags list`

### Usage

```sh
pstdio tags list [--project-id <project-id>]
```

### Behavior

1. Resolve the project.
2. Fetch all tag definitions with their options, ordered by name.

### Output

```text
label (single_select)
  bug  red
  feature  blue
  documentation  purple
  chore  gray
priority (single_select)
  P1  red
  P2  orange
  P3  yellow
```

If no tags exist:

```text
No tags found.
```

---

## `pstdio tags delete`

### Usage

```sh
pstdio tags delete --name <name> [--project-id <project-id>]
```

### Behavior

1. Resolve the project.
2. Look up the tag definition by name. Fail if it does not exist.
3. Soft-delete the tag definition by setting `deleted_at`. Existing option assignments are preserved.

### Output

```text
Deleted tag "priority"
```

---

## Schema

### `ticket_tags` (tag definitions)

| Column       | Type   | Description                                      |
| ------------ | ------ | ------------------------------------------------ |
| `id`         | `text` | Primary key (UUID).                              |
| `project_id` | `text` | FK → projects.id.                                |
| `name`       | `text` | Tag definition name.                             |
| `type`       | `text` | `single_select` or `multi_select`.               |
| `created_at` | `text` | Creation timestamp.                              |
| `updated_at` | `text` | Last update timestamp.                           |
| `deleted_at` | `text` | Soft-delete timestamp. `null` when active.       |

### `ticket_tag_options`

| Column       | Type      | Description                                      |
| ------------ | --------- | ------------------------------------------------ |
| `id`         | `text`    | Primary key (UUID).                              |
| `tag_id`     | `text`    | FK → ticket_tags.id.                             |
| `name`       | `text`    | Option display name.                             |
| `color`      | `text`    | Display color.                                   |
| `icon`       | `text`    | Optional icon identifier. `null` when unset.     |
| `description`| `text`    | Optional description text. `null` when unset.    |
| `sort_order` | `integer` | Display ordering within the tag.                 |
| `created_at` | `text`    | Creation timestamp.                              |
| `updated_at` | `text`    | Last update timestamp.                           |
| `deleted_at` | `text`    | Soft-delete timestamp. `null` when active.       |

### `ticket_tag_assignments`

| Column                 | Type   | Description                              |
| ---------------------- | ------ | ---------------------------------------- |
| `id`                   | `text` | Primary key (UUID).                      |
| `ticket_id`            | `text` | FK → tickets.id.                         |
| `ticket_tag_option_id` | `text` | FK → ticket_tag_options.id.              |
| `created_at`           | `text` | Creation timestamp.                      |
