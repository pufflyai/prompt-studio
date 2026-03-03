# CLI Spec: `pstdio tickets`

## Purpose

Manage tickets within a pstdio project. Tickets track work items (bugs, features, proposals) and can be created locally for editing before syncing to the database, or created directly via the API.

---

## Ticket Shorthand

Every ticket has a unique shorthand of the form `<PROJECT_SHORTHAND>-<N>`, where:

- `PROJECT_SHORTHAND` is an uppercase prefix stored on the `projects` table. Set once at project creation and never changes. Derived from the project name by taking the first letter of each word (split on spaces, hyphens, or underscores) and uppercasing:
  - `"prompt-studio"` → `PS`
  - `"my app"` → `MA`
  - `"backend"` → `B`
  - `"cool_side_project"` → `CSP`
- `N` is a monotonically increasing integer, scoped per project, starting at `1`.

Examples: `PS-1`, `PS-2`, `PS-42`.

The shorthand is auto-generated when a ticket is created and used as the primary human-readable identifier across the CLI, file system, and UI.

---

## Ticket File Layout

Each ticket lives in its own directory under `.pstdio/tickets/`:

```text
.pstdio/tickets/
  PS-12/
    ticket.md
  PS-13/
    ticket.md
```

---

## Template Placeholders

Templates contain placeholder tokens that are automatically replaced when a ticket is written locally. The CLI replaces all occurrences before writing the file — the caller does not need to handle substitution.

| Placeholder        | Replaced With                                       | Source             |
| ------------------ | --------------------------------------------------- | ------------------ |
| `{{TICKET_ID}}`    | The generated ticket shorthand (e.g. `PS-12`).    | Auto-generated     |
| `{{TICKET_TITLE}}` | Value of `--title`.                                 | `--title` flag     |
| `{{CREATED_AT}}`   | ISO 8601 timestamp at creation time.                | Auto-generated     |
| `{{INPUT}}`        | Value of `--input`, or empty string if omitted.     | `--input` flag     |
| `{{PARENT_ID}}`    | Value of `--parent-id`, or empty string if omitted. | `--parent-id` flag |

Additional template variables can be passed as flags and are matched by name (e.g. `--priority P1` replaces `{{PRIORITY}}`).

---

## `pstdio tickets write`

### Usage

```sh
pstdio tickets write --title <title> --template <template-name> --tag <tag>... [--input <input>] [--parent-id <parent-id>]
```

### Flags

| Flag          | Type       | Required | Description                                                        |
| ------------- | ---------- | -------- | ------------------------------------------------------------------ |
| `--title`     | `string`   | yes      | The ticket title. Replaces `{{TICKET_TITLE}}` in the template.     |
| `--template`  | `string`   | no       | Name of a template to use for the ticket body.                     |
| `--tag`       | `string[]` | no       | One or more tags to assign. Repeatable.                            |
| `--input`     | `string`   | no       | User input or description. Replaces `{{INPUT}}` in the template.   |
| `--parent-id` | `string`   | no       | Parent ticket shorthand. Replaces `{{PARENT_ID}}` in the template. |

### Behavior

1. Must be run inside a linked project (`.pstdio/config.json` must exist).
2. Create a ticket in the database with `draft=true`.
3. Create the ticket directory at `.pstdio/tickets/<shorthand>/`.
4. If `--template` is provided, populate `ticket.md` with the template content after replacing all placeholders (`{{TICKET_ID}}`, `{{TICKET_TITLE}}`, `{{CREATED_AT}}`, `{{INPUT}}`, `{{PARENT_ID}}`).
5. If no `--template`, write a minimal `ticket.md` with the title.
6. If `--tag` values are provided, assign matching tags to the ticket. Tags must already exist in the project.

### Output

```text
Created ticket PS-12 (draft) at .pstdio/tickets/PS-12/ticket.md
```

### Errors

- `"Not inside a pstdio project. Run 'pstdio projects create' first."`: no `.pstdio/config.json` found.
- `"Template not found: <template-name>"`: the given template does not exist.
- `"Tag not found: <tag>"`: the given tag does not exist in the project.

---

## `pstdio tickets create`

### Usage

```sh
pstdio tickets create --content <content> --tag <tag>...
```

### Flags

| Flag        | Type       | Required | Description                             |
| ----------- | ---------- | -------- | --------------------------------------- |
| `--content` | `string`   | yes      | The ticket content (title or body).     |
| `--tag`     | `string[]` | no       | One or more tags to assign. Repeatable. |

### Behavior

1. Must be run inside a linked project.
2. Create a ticket directly in the database. Does not write a local file.
3. If `--tag` values are provided, assign matching tags to the ticket.

### Output

```text
Created ticket PS-13
```

### Errors

- `"Not inside a pstdio project. Run 'pstdio projects create' first."`: no `.pstdio/config.json` found.
- `"Tag not found: <tag>"`: the given tag does not exist in the project.

---

## `pstdio tickets save`

### Usage

```sh
pstdio tickets save --id <ticket-shorthand> --tag <tag>...
```

### Flags

| Flag    | Type       | Required | Description                                       |
| ------- | ---------- | -------- | ------------------------------------------------- |
| `--id`  | `string`   | yes      | The ticket shorthand (e.g. `PS-12`).            |
| `--tag` | `string[]` | no       | One or more tags to assign or update. Repeatable. |

### Behavior

1. Must be run inside a linked project.
2. Read the local ticket file at `.pstdio/tickets/<ticket-shorthand>/ticket.md`.
3. Update the ticket in the database with the local file content.
4. Set `draft=false` to publish the ticket.
5. If `--tag` values are provided, update the tag assignments.

### Output

```text
Pushed ticket PS-12
```

### Errors

- `"Not inside a pstdio project. Run 'pstdio projects create' first."`: no `.pstdio/config.json` found.
- `"Local ticket not found: .pstdio/tickets/<ticket-shorthand>/ticket.md"`: no local file for the given shorthand.
- `"Ticket not found: <ticket-shorthand>"`: the ticket does not exist in the database.
- `"Tag not found: <tag>"`: the given tag does not exist in the project.

---

## `pstdio tickets list`

### Usage

```sh
pstdio tickets list [--project-id <project-id>] [--status <status>] [--tag <tag>...] [--priority <priority>] [--complexity <complexity>] [--archived] [--draft] [--parent-id <parent-id>]
```

### Flags

| Flag           | Type       | Required | Description                                                           |
| -------------- | ---------- | -------- | --------------------------------------------------------------------- |
| `--project-id` | `string`   | no       | List tickets for a specific project. Defaults to the current project. |
| `--status`     | `string`   | no       | Filter by status name.                                                |
| `--tag`        | `string[]` | no       | Filter by tag. Repeatable. Tickets matching **any** given tag are returned. |
| `--priority`   | `string`   | no       | Filter by priority (e.g. `P1`, `P2`, `P3`).                          |
| `--complexity` | `string`   | no       | Filter by complexity (`low`, `medium`, `high`).                       |
| `--archived`   | `boolean`  | no       | Include archived tickets. Excluded by default.                        |
| `--draft`      | `boolean`  | no       | Include draft tickets. Excluded by default.                           |
| `--parent-id`  | `string`   | no       | Filter by parent ticket shorthand. Returns only sub-tickets.          |

### Behavior

1. If `--project-id` is not provided, use the project from `.pstdio/config.json`.
2. Fetch all non-deleted tickets for the project from the database.
3. Apply any provided filters. Multiple filters are combined with AND.

### Output

```text
Shorthand   Title                Status      Tags
PS-12     Fix login bug        backlog     bug
PS-13     Add dark mode        wip         feature, ui
PS-14     Update docs          done
```

If no tickets exist:

```text
No tickets found.
```

### Errors

- `"Not inside a pstdio project. Run 'pstdio projects create' first."`: no `--project-id` flag and no `.pstdio/config.json` found.
- `"Project not found: <project-id>"`: the given project ID does not exist.

---

## `pstdio tickets update`

### Usage

```sh
pstdio tickets update --id <ticket-shorthand> [--status <status>] [--tag <tag>...]
```

### Flags

| Flag       | Type       | Required | Description                                                                   |
| ---------- | ---------- | -------- | ----------------------------------------------------------------------------- |
| `--id`     | `string`   | yes      | The ticket shorthand (e.g. `PS-12`).                                        |
| `--status` | `string`   | no       | New status name for the ticket. Must match an existing status in the project. |
| `--tag`    | `string[]` | no       | Replace current tags with the given set. Repeatable.                          |

### Behavior

1. Must be run inside a linked project.
2. Update ticket properties in the database. Only `--status` and `--tag` are supported — content is updated via `tickets push`.
3. If `--status` is provided, look up the status by name and assign its ID.
4. If `--tag` is provided, replace the current tag assignments with the new set.

### Output

```text
Updated ticket PS-12
```

### Errors

- `"Not inside a pstdio project. Run 'pstdio projects create' first."`: no `.pstdio/config.json` found.
- `"Ticket not found: <ticket-shorthand>"`: the ticket does not exist in the database.
- `"Status not found: <status>"`: the given status name does not exist in the project.
- `"Tag not found: <tag>"`: the given tag does not exist in the project.

---

## `pstdio tickets implement`

### Usage

```sh
pstdio tickets implement --id <ticket-shorthand>
```

### Flags

| Flag   | Type     | Required | Description                            |
| ------ | -------- | -------- | -------------------------------------- |
| `--id` | `string` | yes      | The ticket shorthand (e.g. `PS-12`). |

### Behavior

1. Must be run inside a linked project.
2. Move the ticket status to `wip`.
3. Launch the default configured agent to work on the ticket.

### Output

```text
Ticket PS-12 moved to wip
Launching agent...
```

### Errors

- `"Not inside a pstdio project. Run 'pstdio projects create' first."`: no `.pstdio/config.json` found.
- `"Ticket not found: <ticket-shorthand>"`: the ticket does not exist in the database.
- `"No agent configured. Run 'pstdio agents setup' first."`: no default agent is set up.

---

## Local Side Effects

| Path                                    | Description                                           |
| --------------------------------------- | ----------------------------------------------------- |
| `.pstdio/tickets/<shorthand>/ticket.md` | Local ticket file created by `write`, read by `push`. |
