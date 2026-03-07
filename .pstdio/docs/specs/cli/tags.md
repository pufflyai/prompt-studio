# `pstdio tags`

## Purpose

Manage ticket tags within a pstdio project. Tags are labels that can be assigned to tickets for categorization and filtering (e.g. `bug`, `feature`, `ui`).

---

## Available Colors

The `--color` flag accepts one of the following values:

`gray`, `red`, `orange`, `amber`, `yellow`, `lime`, `green`, `teal`, `cyan`, `blue`, `indigo`, `violet`, `purple`, `pink`, `rose`

Using a value not in this list is an error.

---

## Default Tags

Projects are initialized with the following tags:

| Name            | Color    |
| --------------- | -------- |
| `bug`           | `red`    |
| `feature`       | `blue`   |
| `documentation` | `purple` |

---

## `pstdio tags create`

### Usage

```sh
pstdio tags create --name <name> --color <color> [--project-id <project-id>]
```

### Flags

| Flag           | Type     | Required | Description                                                                 |
| -------------- | -------- | -------- | --------------------------------------------------------------------------- |
| `--name`       | `string` | yes      | Tag name. Must be unique within the project.                                |
| `--color`      | `string` | yes      | Display color for the tag.                                                  |
| `--project-id` | `string` | no       | Target project. Defaults to the current project from `.pstdio/config.json`. |

### Behavior

1. Resolve the project: use `--project-id` if provided, otherwise fall back to `.pstdio/config.json`.
2. Create the tag in the database, associated with the project.

### Output

```text
Created tag "bug"
```

### Errors

- `"No project specified. Provide --project-id or run inside a linked project."`: no `--project-id` flag and no `.pstdio/config.json` found.
- `"Project not found: <project-id>"`: the given project ID does not exist.
- `"Tag already exists: <name>"`: a tag with this name already exists in the project.

---

## `pstdio tags list`

### Usage

```sh
pstdio tags list [--project-id <project-id>]
```

### Flags

| Flag           | Type     | Required | Description                                                                 |
| -------------- | -------- | -------- | --------------------------------------------------------------------------- |
| `--project-id` | `string` | no       | Target project. Defaults to the current project from `.pstdio/config.json`. |

### Behavior

1. Resolve the project: use `--project-id` if provided, otherwise fall back to `.pstdio/config.json`.
2. Fetch all tags for the project, ordered by name.

### Output

```text
Name       Color
bug        red
feature    blue
ui         purple
```

If no tags exist:

```text
No tags found.
```

### Errors

- `"No project specified. Provide --project-id or run inside a linked project."`: no `--project-id` flag and no `.pstdio/config.json` found.
- `"Project not found: <project-id>"`: the given project ID does not exist.

---

## `pstdio tags delete`

### Usage

```sh
pstdio tags delete --name <name> [--project-id <project-id>]
```

### Flags

| Flag           | Type     | Required | Description                                                                 |
| -------------- | -------- | -------- | --------------------------------------------------------------------------- |
| `--name`       | `string` | yes      | Name of the tag to delete.                                                  |
| `--project-id` | `string` | no       | Target project. Defaults to the current project from `.pstdio/config.json`. |

### Behavior

1. Resolve the project: use `--project-id` if provided, otherwise fall back to `.pstdio/config.json`.
2. Look up the tag by name. Fail if it does not exist.
3. Soft-delete the tag by setting `deleted_at`. Existing tag assignments are preserved — deleted tags are hidden from lists and cannot be assigned to new tickets, but if the tag is restored (by clearing `deleted_at`), tickets retain their original tag assignments.

### Output

```text
Deleted tag "bug"
```

### Errors

- `"No project specified. Provide --project-id or run inside a linked project."`: no `--project-id` flag and no `.pstdio/config.json` found.
- `"Project not found: <project-id>"`: the given project ID does not exist.
- `"Tag not found: <name>"`: the tag does not exist or is already deleted.

---

## Schema Changes Required

The `ticket_tags` table needs the following columns added:

| Column       | Type   | Description                                           |
| ------------ | ------ | ----------------------------------------------------- |
| `deleted_at` | `text` | Soft-delete timestamp. `null` when the tag is active. |
