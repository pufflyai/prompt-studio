---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# Product Requirements Document: CLI Statuses

## Summary

This PRD documents status management commands and default status rules used by ticket workflows.

## Detailed Behavior

## Purpose

Manage ticket statuses within a pstdio project. Statuses represent workflow stages (e.g. backlog, wip, done) and are displayed as columns in the board UI. Every project has a default status that is automatically assigned to new tickets on creation.

## Project Settings Placement

- Statuses are managed in Project Settings under a dedicated **Ticket Statuses** section.
- Statuses are treated as a project-level single-select definition: users can create, edit, reorder, set default, and archive options.
- Archiving a status removes it from active selectors while preserving existing ticket references.

---

## Available Colors

The `--color` flag accepts one of the following values:

`gray`, `red`, `orange`, `amber`, `yellow`, `lime`, `green`, `teal`, `cyan`, `blue`, `indigo`, `violet`, `purple`, `pink`, `rose`

Using a value not in this list is an error.

---

## Default Statuses

Projects are initialized with the following statuses:

| Name      | Color   | Sort Order | Default | Open |
| --------- | ------- | ---------- | ------- | ---- |
| `backlog` | `gray`  | 0          | yes     | yes  |
| `ready`   | `teal`  | 1          | no      | yes  |
| `wip`     | `blue`  | 2          | no      | yes  |
| `blocked` | `red`   | 3          | no      | yes  |
| `review`  | `amber` | 4          | no      | yes  |
| `done`    | `green` | 5          | no      | no   |

---

## `pstdio statuses create`

### Usage

```sh
pstdio statuses create --name <name> --color <color> [--project-id <project-id>] [--default]
```

### Flags

| Flag           | Type      | Required | Description                                                                 |
| -------------- | --------- | -------- | --------------------------------------------------------------------------- |
| `--name`       | `string`  | yes      | Status name. Must be unique within the project.                             |
| `--color`      | `string`  | yes      | Display color for the status.                                               |
| `--project-id` | `string`  | no       | Target project. Defaults to the current project from `.pstdio/config.json`. |
| `--default`    | `boolean` | no       | Set as the default status for the project.                                  |

### Behavior

1. Resolve the project: use `--project-id` if provided, otherwise fall back to `.pstdio/config.json`.
2. Create the status in the database with `sort_order` set to the next available position (max existing + 1).
3. If `--default` is set, mark this status as the default and unset the previous default.

### Output

```text
Created status "triaging"
```

### Errors

- `"No project specified. Provide --project-id or run inside a linked project."`: no `--project-id` flag and no `.pstdio/config.json` found.
- `"Project not found: <project-id>"`: the given project ID does not exist.
- `"Status already exists: <name>"`: a status with this name already exists in the project.

---

## `pstdio statuses list`

### Usage

```sh
pstdio statuses list [--project-id <project-id>]
```

### Flags

| Flag           | Type     | Required | Description                                                                 |
| -------------- | -------- | -------- | --------------------------------------------------------------------------- |
| `--project-id` | `string` | no       | Target project. Defaults to the current project from `.pstdio/config.json`. |

### Behavior

1. Resolve the project: use `--project-id` if provided, otherwise fall back to `.pstdio/config.json`.
2. Fetch all statuses for the project, ordered by `sort_order`.

### Output

```text
Name      Color   Default
backlog   gray    *
wip       blue
review    amber
done      green
```

- `Default`: `*` marks the default status.

If no statuses exist:

```text
No statuses found.
```

### Errors

- `"No project specified. Provide --project-id or run inside a linked project."`: no `--project-id` flag and no `.pstdio/config.json` found.
- `"Project not found: <project-id>"`: the given project ID does not exist.

---

## `pstdio statuses set-default`

### Usage

```sh
pstdio statuses set-default --name <name> [--project-id <project-id>]
```

### Flags

| Flag           | Type     | Required | Description                                                                 |
| -------------- | -------- | -------- | --------------------------------------------------------------------------- |
| `--name`       | `string` | yes      | Name of the status to set as default.                                       |
| `--project-id` | `string` | no       | Target project. Defaults to the current project from `.pstdio/config.json`. |

### Behavior

1. Resolve the project: use `--project-id` if provided, otherwise fall back to `.pstdio/config.json`.
2. Look up the status by name. Fail if it does not exist.
3. Set `is_default=true` on this status and `is_default=false` on the previous default.

### Output

```text
Default status set to "wip"
```

### Errors

- `"No project specified. Provide --project-id or run inside a linked project."`: no `--project-id` flag and no `.pstdio/config.json` found.
- `"Project not found: <project-id>"`: the given project ID does not exist.
- `"Status not found: <name>"`: the status does not exist in the project.

---

## `pstdio statuses delete`

### Usage

```sh
pstdio statuses delete --name <name> [--project-id <project-id>]
```

### Flags

| Flag           | Type     | Required | Description                                                                 |
| -------------- | -------- | -------- | --------------------------------------------------------------------------- |
| `--name`       | `string` | yes      | Name of the status to delete.                                               |
| `--project-id` | `string` | no       | Target project. Defaults to the current project from `.pstdio/config.json`. |

### Behavior

1. Resolve the project: use `--project-id` if provided, otherwise fall back to `.pstdio/config.json`.
2. Look up the status by name. Fail if it does not exist.
3. Fail if the status is the current default — a new default must be set first.
4. Soft-delete the status by setting `deleted_at`. Existing ticket assignments are preserved — deleted statuses are hidden from lists and cannot be assigned to new tickets, but if the status is restored (by clearing `deleted_at`), tickets retain their original status.

### Output

```text
Deleted status "triaging"
```

### Errors

- `"No project specified. Provide --project-id or run inside a linked project."`: no `--project-id` flag and no `.pstdio/config.json` found.
- `"Project not found: <project-id>"`: the given project ID does not exist.
- `"Status not found: <name>"`: the status does not exist or is already deleted.
- `"Cannot delete the default status. Set a different default first."`: the status is the current default.

---

## Auto-Apply on Ticket Creation

When a ticket is created (via `tickets write`, `tickets create`, or the API), the project's default status is automatically assigned as the ticket's `status_id`. This ensures every ticket starts in a known workflow stage without requiring the caller to specify a status explicitly.

---

## Automation

Implementation automation (for example automatically starting work) is configured with plugins in `.pstdio/plugins/`, not with status metadata. See `.pstdio/docs/product/cli/hooks.md` for hook lifecycle behavior.

---

## Schema Changes Required

The `ticket_statuses` table needs the following columns added:

| Column       | Type   | Description                                              |
| ------------ | ------ | -------------------------------------------------------- |
| `deleted_at` | `text` | Soft-delete timestamp. `null` when the status is active. |
