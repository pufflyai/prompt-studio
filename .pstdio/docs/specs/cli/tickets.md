# `pstdio tickets`

## Purpose

Manage tickets within a pstdio project. Tickets track work items (bugs, features, proposals) and can be created locally for editing before syncing to the database, or created directly via the API.

---

## Ticket Content Model

Ticket payload fields have distinct meanings and must not be treated as interchangeable:

| Field         | Meaning                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| `user_prompt` | The user's prompt text for tasking an agent. It is instruction context, not the canonical ticket body. |
| `file_id`     | Reference to the canonical ticket content file stored in the `files` table.                            |
| `content`     | The actual ticket body text stored in the file referenced by `file_id`.                                |

Rules:

1. `user_prompt` is only for agent tasking context (for example, `tickets write --user-prompt ...` or API `user_prompt`).
2. Ticket body content is read from and written to the file referenced by `file_id`.
3. Anywhere this spec says "ticket content", it means the body stored in `file_id`.

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

## Display Title

Each ticket directory includes a **display title** suffix derived from the ticket's markdown content. The directory name follows the format `<shorthand>_<display_title>`.

### Extracting the display title

The display title is extracted from the markdown content written to `ticket.md`:

1. **Skip YAML frontmatter** — if the content starts with `---`, skip everything up to and including the closing `---`.
2. **Find the first `# heading`** — scan remaining lines for the first line starting with `# ` (ATX heading level 1).
3. **Strip markdown formatting** — remove `**`, `*`, `` ` ``, and convert `[text](url)` to `text`.
4. **Slugify** the extracted text:
   a. Lowercase.
   b. Replace any run of non-alphanumeric characters with a single hyphen.
   c. Strip leading and trailing hyphens.
   d. Truncate to 50 characters.
   e. Strip any trailing hyphens left after truncation.
5. **Fallback** — if no `# heading` is found, use the first non-empty, non-frontmatter line instead and apply steps 3–4.

The maximum length of the full directory name (`<shorthand>_<display_title>`) is **80 characters**. The display title is truncated as needed to stay within this limit.

### Examples

| Markdown content (first heading) | Display Title     | Directory Name          |
| -------------------------------- | ----------------- | ----------------------- |
| `# Fix login bug`                | `fix-login-bug`   | `PS-12_fix-login-bug`   |
| `# Add dark mode`                | `add-dark-mode`   | `PS-13_add-dark-mode`   |
| `# Update **all** docs`          | `update-all-docs` | `PS-14_update-all-docs` |
| `# [Link](http://x.com) cleanup` | `link-cleanup`    | `PS-15_link-cleanup`    |

### Lookup

When looking up a ticket directory by shorthand, the CLI searches for a directory whose name starts with `<shorthand>_`. The display title is set at creation time and is not updated when the ticket content changes.

---

## Ticket File Layout

Each ticket lives in its own directory under `.pstdio/tickets/`:

```text
.pstdio/tickets/
  PS-12_fix-login-bug/
    ticket.md
    files/
      architecture.md
      api-schema.json
    artifacts/
      test-output.log
      screenshot.png
  PS-13_add-dark-mode/
    ticket.md
```

- `ticket.md` is the canonical local ticket body. Locally it includes YAML frontmatter; the stored version on the server never contains frontmatter.
- `files/` contains supporting files associated with the ticket (research, schemas, specs).
- `artifacts/` contains change validation outputs (test logs, screenshots, build output).

### Frontmatter is Local-Only

YAML frontmatter in `ticket.md` is a local convention only. The server stores the ticket body without frontmatter.

- **On save**: strip frontmatter from `ticket.md` before uploading. Actionable fields (`status`, `priority`, `complexity`) are extracted and sent as ticket properties.
- **On pull**: build frontmatter from the ticket's database fields and prepend it to the downloaded body content.
- **On write/create**: write frontmatter to the local file. Upload the body content without frontmatter.

---

## Template Placeholders

Templates contain placeholder tokens that are automatically replaced when a ticket is written locally. The CLI replaces all occurrences before writing the file — the caller does not need to handle substitution.

| Placeholder        | Replaced With                                         | Source               |
| ------------------ | ----------------------------------------------------- | -------------------- |
| `{{TICKET_ID}}`    | The generated ticket shorthand (e.g. `PS-12`).        | Auto-generated       |
| `{{TICKET_TITLE}}` | Value of `--title`.                                   | `--title` flag       |
| `{{CREATED_AT}}`   | ISO 8601 timestamp at creation time.                  | Auto-generated       |
| `{{USER_PROMPT}}`  | Value of `--user-prompt`, or empty string if omitted. | `--user-prompt` flag |
| `{{PARENT_ID}}`    | Value of `--parent-id`, or empty string if omitted.   | `--parent-id` flag   |
| `{{STATUS}}`       | Value of `--status`, or `"backlog"` if omitted.       | `--status` flag      |

Additional template variables can be passed as flags and are matched by name (e.g. `--priority P1` replaces `{{PRIORITY}}`).

---

## `pstdio tickets write`

### Usage

```sh
pstdio tickets write --title <title> --template <template-name> --tag <tag>... [--status <status>] [--user-prompt <user-prompt>] [--parent-id <parent-id>]
```

### Flags

| Flag            | Type       | Required | Description                                                                     |
| --------------- | ---------- | -------- | ------------------------------------------------------------------------------- |
| `--title`       | `string`   | yes      | The ticket title. Replaces `{{TICKET_TITLE}}` in the template.                  |
| `--template`    | `string`   | no       | Name of a template to use for the ticket body.                                  |
| `--tag`         | `string[]` | no       | One or more tags to assign. Repeatable.                                         |
| `--status`      | `string`   | no       | Status name to assign. Defaults to the project's default status.                |
| `--user-prompt` | `string`   | no       | Agent-tasking prompt from the user. Replaces `{{USER_PROMPT}}` in the template. |
| `--parent-id`   | `string`   | no       | Parent ticket shorthand. Replaces `{{PARENT_ID}}` in the template.              |

### Behavior

1. Must be run inside a linked project (`.pstdio/config.json` must exist).
2. Create a ticket in the database with `draft=true`. Assign the status from `--status` if provided, otherwise assign the project's default status.
3. Create the ticket directory at `.pstdio/tickets/<shorthand>_<display_title>/` (see [Display Title](#display-title)).
4. If `--template` is provided, fetch the template from the API and populate `ticket.md` with the template content after replacing all placeholders (`{{TICKET_ID}}`, `{{TICKET_TITLE}}`, `{{CREATED_AT}}`, `{{USER_PROMPT}}`, `{{PARENT_ID}}`, `{{STATUS}}`).
5. If no `--template`, write a minimal `ticket.md` with the title.
6. If `--tag` values are provided, assign matching tags to the ticket. Tags must already exist in the project.

### Output

```text
Created ticket PS-12 (draft) at .pstdio/tickets/PS-12_fix-login-bug/ticket.md
```

### Errors

- `"Not inside a pstdio project. Run 'pstdio projects create' first."`: no `.pstdio/config.json` found.
- `"Template not found: <template-name>"`: the given template does not exist.
- `"Status not found: <status>"`: the given status name does not exist in the project.
- `"Tag not found: <tag>"`: the given tag does not exist in the project.

---

## `pstdio tickets create`

### Usage

```sh
pstdio tickets create --content <content> [--project-id <project-id>] [--status <status>] [--tag <tag>...]
```

### Flags

| Flag           | Type       | Required | Description                                                                       |
| -------------- | ---------- | -------- | --------------------------------------------------------------------------------- |
| `--content`    | `string`   | yes      | Canonical ticket body content. Stored in the ticket file referenced by `file_id`. |
| `--project-id` | `string`   | no       | Target project. Defaults to the current project from `.pstdio/config.json`.       |
| `--status`     | `string`   | no       | Status name to assign. Defaults to the project's default status.                  |
| `--tag`        | `string[]` | no       | One or more tags to assign. Repeatable.                                           |

### Behavior

1. Resolve the project: use `--project-id` if provided, otherwise fall back to `.pstdio/config.json`.
2. Create a ticket in the database with `draft=false`. Assign the status from `--status` if provided, otherwise assign the project's default status.
3. Upload the ticket content (without frontmatter) as a file to the database, set `ticket.file_id` to that file, and treat that file body as the ticket's canonical content.
4. If `--tag` values are provided, assign matching tags to the ticket.
5. If running inside a linked project (`.pstdio/config.json` exists), write a local `ticket.md` with YAML frontmatter and the ticket title. See [Frontmatter Fields](#frontmatter-fields) for the frontmatter format. If not inside a linked project, no local file is written.

### Output

```text
Created ticket PS-13
```

### Errors

- `"No project specified. Provide --project-id or run inside a linked project."`: no `--project-id` flag and no `.pstdio/config.json` found.
- `"Project not found: <project-id>"`: the given project ID does not exist.
- `"Status not found: <status>"`: the given status name does not exist in the project.
- `"Tag not found: <tag>"`: the given tag does not exist in the project.

---

## `pstdio tickets view`

### Usage

```sh
pstdio tickets view --id <ticket-shorthand> [--project-id <project-id>]
```

### Flags

| Flag           | Type     | Required | Description                                                                 |
| -------------- | -------- | -------- | --------------------------------------------------------------------------- |
| `--id`         | `string` | yes      | The ticket shorthand or ID (e.g. `PS-12`).                                  |
| `--project-id` | `string` | no       | Target project. Defaults to the current project from `.pstdio/config.json`. |

### Behavior

1. Resolve the project: use `--project-id` if provided, otherwise fall back to `.pstdio/config.json`.
2. Fetch the ticket from the database by shorthand or ID.
3. Resolve ticket status name and tags.
4. Display a summary of the ticket.

### Output

```text
Shorthand:   PS-12
Title:       Fix login bug
Status:      backlog
Tags:        bug
Priority:    P1
Complexity:  medium
Created:     2026-01-15T10:00:00Z
Updated:     2026-01-20T14:30:00Z
```

When a ticket has no tags, the `Tags` line shows `-`.

When priority or complexity is not set, those lines show `-`.

### Errors

- `"No project specified. Provide --project-id or run inside a linked project."`: no `--project-id` flag and no `.pstdio/config.json` found.
- `"Project not found: <project-id>"`: the given project ID does not exist.
- `"Ticket not found: <ticket-shorthand>"`: the ticket does not exist in the database.

---

## `pstdio tickets save`

### Usage

```sh
pstdio tickets save --id <ticket-shorthand> [--status <status>] [--tag <tag>...]
```

### Flags

| Flag       | Type       | Required | Description                                                          |
| ---------- | ---------- | -------- | -------------------------------------------------------------------- |
| `--id`     | `string`   | yes      | The ticket shorthand (e.g. `PS-12`).                                 |
| `--status` | `string`   | no       | Status name to assign. Must match an existing status in the project. |
| `--tag`    | `string[]` | no       | One or more tags to assign or update. Repeatable.                    |

### Behavior

1. Must be run inside a linked project.
2. Find the local ticket directory matching `<ticket-shorthand>_*` and read `ticket.md` from it.
3. Parse YAML frontmatter from `ticket.md` and extract actionable fields (`status`, `priority`, `complexity`).
4. Strip frontmatter from `ticket.md` and upload the body content (without frontmatter) as the ticket file. Apply extracted frontmatter fields as ticket properties.
5. Set `draft=false` to publish the ticket.
6. Resolve the ticket status: use `--status` flag if provided, otherwise use `status` from frontmatter. Look up the status by name and assign its ID.
7. Set `priority` and `complexity` from frontmatter values when present.
8. If `.pstdio/tickets/<ticket-shorthand>/files/` exists, upload every file under it and associate it with the ticket.
9. If `.pstdio/tickets/<ticket-shorthand>/artifacts/` exists, upload every file under it and associate it with the ticket.
9. If `--tag` values are provided, update the tag assignments.

CLI flags always override frontmatter values. When neither a flag nor a frontmatter value is present, the field is left unchanged in the database.

### Output

```text
Saved ticket PS-12
Uploaded 2 ticket files
```

If no files were uploaded, omit the second line.

### Errors

- `"Not inside a pstdio project. Run 'pstdio projects create' first."`: no `.pstdio/config.json` found.
- `"Local ticket not found: .pstdio/tickets/<ticket-shorthand>/ticket.md"`: no local file for the given shorthand.
- `"Ticket not found: <ticket-shorthand>"`: the ticket does not exist in the database.
- `"Status not found: <status>"`: the given status name does not exist in the project.
- `"Tag not found: <tag>"`: the given tag does not exist in the project.

---

## `pstdio tickets pull`

### Usage

```sh
pstdio tickets pull [--id <ticket-shorthand>] [--force]
```

### Flags

| Flag      | Type      | Required | Description                                                                        |
| --------- | --------- | -------- | ---------------------------------------------------------------------------------- |
| `--id`    | `string`  | no       | The ticket shorthand (e.g. `PS-12`). When omitted, pulls all non-archived tickets. |
| `--force` | `boolean` | no       | Overwrite local files if they already exist at the destination path.               |

### Behavior

#### With `--id`

1. Must be run inside a linked project.
2. Fetch the ticket from the database by shorthand.
3. Create the local ticket directory at `.pstdio/tickets/<ticket-shorthand>/` when missing.
4. Build YAML frontmatter from the ticket's database fields and prepend it to the ticket body content (replacing any existing frontmatter). See [Frontmatter Fields](#frontmatter-fields).
5. Write the result to `.pstdio/tickets/<ticket-shorthand>/ticket.md`.
6. Fetch all files linked to the ticket in the database and write them to `.pstdio/tickets/<ticket-shorthand>/files/` (supporting files) and `.pstdio/tickets/<ticket-shorthand>/artifacts/` (validation artifacts).
7. If a target file path already exists and `--force` is not set, fail without overwriting that file.

#### Without `--id`

1. Must be run inside a linked project.
2. Fetch all non-archived tickets for the project from the database.
3. For each ticket, perform the same steps as the single-ticket pull (steps 3–7 above).
4. Log a summary of how many tickets were pulled.

#### Frontmatter Fields

The following fields are always written:

| Field     | Source               |
| --------- | -------------------- |
| `created` | `created_at` from DB |

The following fields are included only when non-null:

| Field            | Source                         |
| ---------------- | ------------------------------ |
| `status`         | Status name (resolved from ID) |
| `parent_id`      | `parent_id` from DB            |
| `priority`       | `priority` from DB             |
| `complexity`     | `complexity` from DB           |
| `depends_on`     | `depends_on` from DB           |
| `parallelizable` | `parallelizable` from DB       |
| `blocked_reason` | `blocked_reason` from DB       |

### Output

Single ticket:

```text
Pulled ticket PS-12 to .pstdio/tickets/PS-12
Downloaded 2 ticket files
```

If no files are linked to the ticket, omit the second line.

All tickets:

```text
Pulled 5 tickets
```

If no non-archived tickets exist:

```text
No tickets to pull.
```

### Errors

- `"Not inside a pstdio project. Run 'pstdio projects create' first."`: no `.pstdio/config.json` found.
- `"Ticket not found: <ticket-shorthand>"`: the ticket does not exist in the database (single-ticket mode).
- `"Local file already exists: <path>. Use --force to overwrite."`: local file conflict during pull.

---

## `pstdio tickets files`

### Usage

```sh
pstdio tickets files --id <ticket-shorthand> [--project-id <project-id>]
```

### Flags

| Flag           | Type     | Required | Description                                                                 |
| -------------- | -------- | -------- | --------------------------------------------------------------------------- |
| `--id`         | `string` | yes      | The ticket shorthand (e.g. `PS-12`).                                        |
| `--project-id` | `string` | no       | Target project. Defaults to the current project from `.pstdio/config.json`. |

### Behavior

1. Resolve the project: use `--project-id` if provided, otherwise fall back to `.pstdio/config.json`.
2. Resolve the ticket by shorthand from the database.
3. List files linked to the ticket in the database.
4. If running inside a linked project, list local files under `.pstdio/tickets/<ticket-shorthand>/files/` and `.pstdio/tickets/<ticket-shorthand>/artifacts/`.
5. Output a merged view showing whether each file exists in DB, locally, or both. When running outside a linked project, the Local column is always `–` .

### Output

```text
File Name          DB    Local   Local Path
architecture.md    yes   yes     .pstdio/tickets/PS-12/files/architecture.md
screenshot.png     yes   no      -
scratch-notes.txt  no    yes     .pstdio/tickets/PS-12/files/scratch-notes.txt
```

If no file exists in either place:

```text
No ticket files found.
```

### Errors

- `"No project specified. Provide --project-id or run inside a linked project."`: no `--project-id` flag and no `.pstdio/config.json` found.
- `"Project not found: <project-id>"`: the given project ID does not exist.
- `"Ticket not found: <ticket-shorthand>"`: the ticket does not exist in the database.

---

## `pstdio tickets workspaces`

### Usage

```sh
pstdio tickets workspaces --id <ticket-shorthand> [--project-id <project-id>]
```

### Flags

| Flag           | Type     | Required | Description                                                                 |
| -------------- | -------- | -------- | --------------------------------------------------------------------------- |
| `--id`         | `string` | yes      | The ticket shorthand (e.g. `PS-12`).                                        |
| `--project-id` | `string` | no       | Target project. Defaults to the current project from `.pstdio/config.json`. |

### Behavior

1. Resolve the project: use `--project-id` if provided, otherwise fall back to `.pstdio/config.json`.
2. Resolve the ticket by shorthand from the database.
3. List active workspaces linked to the ticket in the database.
4. Show workspace shorthand, status, branch, and worktree path for each associated workspace.

### Output

```text
Workspace   Status   Branch               Path
PS-12/A1    active   workspace/PS-12/A1   /repo/.pstdio/workspaces/PS-12/A1
PS-12/A2    active   workspace/PS-12/A2   /repo/.pstdio/workspaces/PS-12/A2
```

If the ticket has no active workspaces:

```text
No ticket workspaces found.
```

### Errors

- `"No project specified. Provide --project-id or run inside a linked project."`: no `--project-id` flag and no `.pstdio/config.json` found.
- `"Project not found: <project-id>"`: the given project ID does not exist.
- `"Ticket not found: <ticket-shorthand>"`: the ticket does not exist in the database.

---

## `pstdio tickets list`

### Usage

```sh
pstdio tickets list [--project-id <project-id>] [--status <status>] [--tag <tag>...] [--priority <priority>] [--complexity <complexity>] [--archived] [--draft] [--parent-id <parent-id>]
```

### Flags

| Flag           | Type       | Required | Description                                                                 |
| -------------- | ---------- | -------- | --------------------------------------------------------------------------- |
| `--project-id` | `string`   | no       | List tickets for a specific project. Defaults to the current project.       |
| `--status`     | `string`   | no       | Filter by status name.                                                      |
| `--tag`        | `string[]` | no       | Filter by tag. Repeatable. Tickets matching **any** given tag are returned. |
| `--priority`   | `string`   | no       | Filter by priority (e.g. `P1`, `P2`, `P3`).                                 |
| `--complexity` | `string`   | no       | Filter by complexity (`low`, `medium`, `high`).                             |
| `--archived`   | `boolean`  | no       | Include archived tickets. Excluded by default.                              |
| `--draft`      | `boolean`  | no       | Include draft tickets. Excluded by default.                                 |
| `--parent-id`  | `string`   | no       | Filter by parent ticket shorthand. Returns only sub-tickets.                |

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

- `"No project specified. Provide --project-id or run inside a linked project."`: no `--project-id` flag and no `.pstdio/config.json` found.
- `"Project not found: <project-id>"`: the given project ID does not exist.

---

## `pstdio tickets update`

### Usage

```sh
pstdio tickets update --id <ticket-shorthand> [--project-id <project-id>] [--status <status>] [--tag <tag>...]
```

### Flags

| Flag           | Type       | Required | Description                                                                   |
| -------------- | ---------- | -------- | ----------------------------------------------------------------------------- |
| `--id`         | `string`   | yes      | The ticket shorthand (e.g. `PS-12`).                                          |
| `--project-id` | `string`   | no       | Target project. Defaults to the current project from `.pstdio/config.json`.   |
| `--status`     | `string`   | no       | New status name for the ticket. Must match an existing status in the project. |
| `--tag`        | `string[]` | no       | Replace current tags with the given set. Repeatable.                          |

### Behavior

1. Resolve the project: use `--project-id` if provided, otherwise fall back to `.pstdio/config.json`.
2. Update ticket properties in the database. Only `--status` and `--tag` are supported — content and files are updated via `tickets save`.
3. If `--status` is provided, look up the status by name and assign its ID.
4. If `--tag` is provided, replace the current tag assignments with the new set.

### Output

```text
Updated ticket PS-12
```

### Errors

- `"No project specified. Provide --project-id or run inside a linked project."`: no `--project-id` flag and no `.pstdio/config.json` found.
- `"Project not found: <project-id>"`: the given project ID does not exist.
- `"Ticket not found: <ticket-shorthand>"`: the ticket does not exist in the database.
- `"Status not found: <status>"`: the given status name does not exist in the project.
- `"Tag not found: <tag>"`: the given tag does not exist in the project.

---

## `pstdio tickets implement`

### Usage

```sh
pstdio tickets implement --id <ticket-shorthand> [--project-id <project-id>]
```

### Flags

| Flag           | Type     | Required | Description                                                                 |
| -------------- | -------- | -------- | --------------------------------------------------------------------------- |
| `--id`         | `string` | yes      | The ticket shorthand (e.g. `PS-12`).                                        |
| `--project-id` | `string` | no       | Target project. Defaults to the current project from `.pstdio/config.json`. |

### Behavior

1. Resolve the project: use `--project-id` if provided, otherwise fall back to `.pstdio/config.json`.
2. Move the ticket status to `wip`.
3. Launch the default configured agent to work on the ticket.

### Output

```text
Ticket PS-12 moved to wip
Launching agent...
```

### Errors

- `"No project specified. Provide --project-id or run inside a linked project."`: no `--project-id` flag and no `.pstdio/config.json` found.
- `"Project not found: <project-id>"`: the given project ID does not exist.
- `"Ticket not found: <ticket-shorthand>"`: the ticket does not exist in the database.
- `"No agent configured. Run 'pstdio agents setup' first."`: no default agent is set up.

---

## `pstdio tickets delete`

### Usage

```sh
pstdio tickets delete --id <ticket-shorthand> [--project-id <project-id>]
```

### Flags

| Flag           | Type     | Required | Description                                                                 |
| -------------- | -------- | -------- | --------------------------------------------------------------------------- |
| `--id`         | `string` | yes      | The ticket shorthand (e.g. `PS-12`).                                        |
| `--project-id` | `string` | no       | Target project. Defaults to the current project from `.pstdio/config.json`. |

### Behavior

1. Resolve the project: use `--project-id` if provided, otherwise fall back to `.pstdio/config.json`.
2. Resolve the ticket by shorthand from the database.
3. Soft-delete the ticket in the database (set `deleted_at` timestamp).
4. If running inside a linked project, remove the local ticket directory at `.pstdio/tickets/<ticket-shorthand>/` if it exists.

### Output

```text
Deleted ticket PS-12
```

### Errors

- `"No project specified. Provide --project-id or run inside a linked project."`: no `--project-id` flag and no `.pstdio/config.json` found.
- `"Project not found: <project-id>"`: the given project ID does not exist.
- `"Ticket not found: <ticket-shorthand>"`: the ticket does not exist in the database.

---

## `pstdio tickets archive`

### Usage

```sh
pstdio tickets archive --id <ticket-shorthand> [--project-id <project-id>]
```

### Flags

| Flag           | Type     | Required | Description                                                                 |
| -------------- | -------- | -------- | --------------------------------------------------------------------------- |
| `--id`         | `string` | yes      | The ticket shorthand (e.g. `PS-12`).                                        |
| `--project-id` | `string` | no       | Target project. Defaults to the current project from `.pstdio/config.json`. |

### Behavior

1. Resolve the project: use `--project-id` if provided, otherwise fall back to `.pstdio/config.json`.
2. Resolve the ticket by shorthand from the database.
3. Set `archived=true` on the ticket in the database.
4. Archived tickets are excluded from `tickets list` by default (use `--archived` to include them).

### Output

```text
Archived ticket PS-12
```

### Errors

- `"No project specified. Provide --project-id or run inside a linked project."`: no `--project-id` flag and no `.pstdio/config.json` found.
- `"Project not found: <project-id>"`: the given project ID does not exist.
- `"Ticket not found: <ticket-shorthand>"`: the ticket does not exist in the database.
- `"Ticket already archived: <ticket-shorthand>"`: the ticket is already archived.

---

## Local Side Effects

| Path                                                           | Description                                                                                   |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `.pstdio/tickets/<shorthand>_<display_title>/ticket.md`        | Local ticket file created by `write`/`pull`, read by `save`.                                  |
| `.pstdio/tickets/<shorthand>_<display_title>/files/`           | Supporting files (research, schemas, specs) written by `pull`, read by `save`/`files`.        |
| `.pstdio/tickets/<shorthand>_<display_title>/files/<filename>` | Individual supporting files synced between local project and DB.                              |
| `.pstdio/tickets/<shorthand>_<display_title>/artifacts/`       | Validation artifacts (test output, screenshots, logs) written by `pull`, read by `save`/`files`. |
| `.pstdio/tickets/<shorthand>_<display_title>/artifacts/<filename>` | Individual validation artifacts synced between local project and DB.                         |
| `.pstdio/workspaces/<workspace-shorthand>/`                    | Git worktree path referenced by `pstdio tickets workspaces` for ticket-associated workspaces. |
