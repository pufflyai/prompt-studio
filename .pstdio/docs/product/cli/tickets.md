---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# Product Requirements Document: CLI Tickets

## Summary

This PRD documents ticket creation, local file layout, content rules, sync behavior, and ticket-related command contracts.

## Detailed Behavior

## Purpose

Manage tickets within a Prompt Studio project. Tickets track work items (bugs,
features, proposals) and can be created locally for editing before syncing to
planner extension storage, or created directly through planner commands.

Tickets, ticket statuses, ticket tags, ticket files, and ticket-to-workspace
links are owned by the `pstdio-planner` extension. The core backend no longer
has ticket tables or `/v1/tickets` endpoints.

## Status and Tag Semantics

- `status` is a single required workflow value resolved from the project's Ticket Statuses definition.
- `tag` values are optional labels resolved from the project's Tags set.
- Ticket creation, update, and list filtering support both status and tags without changing their distinct behavior.

---

## Ticket Content Model

Ticket payload fields have distinct meanings and must not be treated as interchangeable:

| Field         | Meaning                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| `user_prompt` | The user's prompt text for tasking an agent. It is instruction context, not the canonical ticket body. |
| `content`     | The actual ticket body text stored by the planner extension.                                           |

Rules:

1. `user_prompt` is only for agent tasking context (for example, `tickets write --user-prompt ...`).
2. Ticket body content is read from and written to planner extension storage.
3. Anywhere this PRD says "ticket content", it means the planner-owned body text.

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

`display_title` is planner metadata derived from ticket markdown content. It is
**not** part of the local ticket directory path.

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

### Examples

| Markdown content (first heading) | Display Title     |
| -------------------------------- | ----------------- |
| `# Fix login bug`                | `fix-login-bug`   |
| `# Add dark mode`                | `add-dark-mode`   |
| `# Update **all** docs`          | `update-all-docs` |
| `# [Link](http://x.com) cleanup` | `link-cleanup`    |

### Local Directory Lookup

The canonical local ticket path is `.pstdio/tickets/<shorthand>/`.

The CLI resolves ticket directories only by exact shorthand path (`.pstdio/tickets/<shorthand>/`).

---

## Ticket File Layout

Each ticket lives in its own directory under `.pstdio/tickets/`:

```text
.pstdio/tickets/
  PS-12/
    ticket.md
    files/
      architecture.md
      api-schema.json
  PS-13/
    ticket.md
```

- `ticket.md` is the canonical local ticket body. Locally it includes YAML frontmatter; the stored version on the server never contains frontmatter.
- `files/` contains supporting files associated with the ticket (research, schemas, PRDs).
- Agent-generated validation, review, test, and implementation evidence belongs in workspace reports under `.pstdio/reports/<name>/`.

### Frontmatter is Local-Only

YAML frontmatter in `ticket.md` is a local convention only. The server stores the ticket body without frontmatter.

- **On save**: strip frontmatter from `ticket.md` before uploading. Actionable fields (`status`) are extracted and sent as ticket properties.
- **On pull**: build frontmatter from planner ticket fields and prepend it to the downloaded body content.
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

Additional template variables can be passed as flags and are matched by name.

---

## `pst tickets write`

### Usage

```sh
pst tickets write --title <title> --template <template-name> --tag <tag>... [--status <status>] [--user-prompt <user-prompt>] [--parent-id <parent-id>]
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
2. Create a planner ticket with `draft=true`. Assign the status from `--status` if provided, otherwise assign the planner default status.
3. Create the ticket directory at `.pstdio/tickets/<shorthand>/`.
4. If `--template` is provided, fetch the template and populate `ticket.md` with the template content after replacing all placeholders (`{{TICKET_ID}}`, `{{TICKET_TITLE}}`, `{{CREATED_AT}}`, `{{USER_PROMPT}}`, `{{PARENT_ID}}`, `{{STATUS}}`).
5. If no `--template`, write a minimal `ticket.md` with the title.
6. If `--tag` values are provided, assign matching tags to the ticket. Tags must already exist in the project.

### Output

```text
Created ticket PS-12 (draft) at .pstdio/tickets/PS-12/ticket.md
```

### Errors

- `"Not inside a Prompt Studio project. Run 'pst projects create' first."`: no `.pstdio/config.json` found.
- `"Template not found: <template-name>"`: the given template does not exist.
- `"Status not found: <status>"`: the given status name does not exist in the project.
- `"Tag not found: <tag>"`: the given tag does not exist in the project.

---

## `pst tickets create`

### Usage

```sh
pst tickets create --content <content> [--project-id <project-id>] [--status <status>] [--tag <tag>...] [--parent-id <parent-id>]
```

### Flags

| Flag           | Type       | Required | Description                                                                 |
| -------------- | ---------- | -------- | --------------------------------------------------------------------------- |
| `--content`    | `string`   | yes      | Canonical planner ticket body content.                                      |
| `--project-id` | `string`   | no       | Target project. Defaults to the current project from `.pstdio/config.json`. |
| `--status`     | `string`   | no       | Status name to assign. Defaults to the project's default status.            |
| `--tag`        | `string[]` | no       | One or more tags to assign. Repeatable.                                     |
| `--parent-id`  | `string`   | no       | Parent ticket shorthand or raw ticket ID.                                   |

### Behavior

1. Resolve the project: use `--project-id` if provided, otherwise fall back to `.pstdio/config.json`.
2. Create a planner ticket with `draft=false`. Assign the status from `--status` if provided, otherwise assign the planner default status.
3. Store the ticket content (without frontmatter) as the planner ticket's canonical content.
4. If `--tag` values are provided, assign matching tags to the ticket.
5. If `--parent-id` is provided, resolve it to a canonical ticket ID and set `parent_id` on the created ticket.
6. If running inside a linked project (`.pstdio/config.json` exists), write a local `ticket.md` with YAML frontmatter and the ticket title. See [Frontmatter Fields](#frontmatter-fields) for the frontmatter format. If not inside a linked project, no local file is written.

### Output

```text
Created ticket PS-13
```

### Errors

- `"No project specified. Provide --project-id or run inside a linked project."`: no `--project-id` flag and no `.pstdio/config.json` found.
- `"Project not found: <project-id>"`: the given project ID does not exist.
- `"Status not found: <status>"`: the given status name does not exist in the project.
- `"Tag not found: <tag>"`: the given tag does not exist in the project.
- `"Parent ticket not found: <parent-id>"`: the given parent ticket shorthand or ID does not resolve.

---

## `pst tickets view`

### Usage

```sh
pst tickets view [field] --id <ticket-shorthand> [--project-id <project-id>]
```

`field` is optional and supports: `status`, `title`, `tags`, `shorthand`, `parent-ticket`, `sub-tickets`.

### Flags

| Flag           | Type     | Required | Description                                                                 |
| -------------- | -------- | -------- | --------------------------------------------------------------------------- |
| `--id`         | `string` | yes      | The ticket shorthand or ID (e.g. `PS-12`).                                  |
| `--project-id` | `string` | no       | Target project. Defaults to the current project from `.pstdio/config.json`. |

### Behavior

1. Resolve the project: use `--project-id` if provided, otherwise fall back to `.pstdio/config.json`.
2. Fetch the ticket from planner extension storage by shorthand or ID.
3. Resolve ticket status name and tags.
4. If `field` is provided, print only that field value.
5. Otherwise display a summary of the ticket.

### Output

```text
Shorthand:   PS-12
Title:       Fix login bug
Status:      backlog
Tags:        bug
Created:     2026-01-15T10:00:00Z
Updated:     2026-01-20T14:30:00Z
```

When a ticket has no tags, the `Tags` line shows `-`.

### Errors

- `"No project specified. Provide --project-id or run inside a linked project."`: no `--project-id` flag and no `.pstdio/config.json` found.
- `"Project not found: <project-id>"`: the given project ID does not exist.
- `"Ticket not found: <ticket-shorthand>"`: the ticket does not exist in planner storage.

---

## `pst tickets save`

### Usage

```sh
pst tickets save --id <ticket-shorthand> [--status <status>] [--tag <tag>...]
```

### Flags

| Flag       | Type       | Required | Description                                                          |
| ---------- | ---------- | -------- | -------------------------------------------------------------------- |
| `--id`     | `string`   | yes      | The ticket shorthand (e.g. `PS-12`).                                 |
| `--status` | `string`   | no       | Status name to assign. Must match an existing status in the project. |
| `--tag`    | `string[]` | no       | One or more tags to assign or update. Repeatable.                    |

### Behavior

1. Must be run inside a linked project.
2. Read `ticket.md` from `.pstdio/tickets/<ticket-shorthand>/`.
3. Parse YAML frontmatter from `ticket.md` and extract actionable fields such as `parent_id` and `blocked_reason`.
4. Strip frontmatter from `ticket.md` and upload the body content (without frontmatter) as the ticket file. Apply extracted frontmatter fields as ticket properties.
5. Set `draft=false` to publish the ticket.
6. Resolve the ticket status only when `--status` is provided. Look up the status by name and assign its ID.
7. If `.pstdio/tickets/<ticket-shorthand>/files/` exists, upload every file under it and associate it with the ticket.
8. If `--tag` values are provided, update the tag assignments.

Use `pst reports write`, `.pstdio/reports/<name>/files/`, and `pst reports save` for test logs, screenshots, build output, review findings, and other agent-produced result artifacts.

`--status` is an explicit status change. If it is omitted, the existing planner status is preserved.

### Output

```text
Saved ticket PS-12
Uploaded 2 ticket files
```

If no files were uploaded, omit the second line.

### Errors

- `"Not inside a Prompt Studio project. Run 'pst projects create' first."`: no `.pstdio/config.json` found.
- `"Local ticket not found: .pstdio/tickets/<ticket-shorthand>/ticket.md"`: no local file for the given shorthand.
- `"Ticket not found: <ticket-shorthand>"`: the ticket does not exist in planner storage.
- `"Status not found: <status>"`: the given status name does not exist in the project.
- `"Tag not found: <tag>"`: the given tag does not exist in the project.

---

## `pst tickets pull`

### Usage

```sh
pst tickets pull [--id <ticket-shorthand>] [--force]
```

### Flags

| Flag      | Type      | Required | Description                                                                        |
| --------- | --------- | -------- | ---------------------------------------------------------------------------------- |
| `--id`    | `string`  | no       | The ticket shorthand (e.g. `PS-12`). When omitted, pulls all non-archived tickets. |
| `--force` | `boolean` | no       | Overwrite local files if they already exist at the destination path.               |

### Behavior

#### With `--id`

1. Must be run inside a linked project.
2. Fetch the ticket from planner extension storage by shorthand.
3. Create the local ticket directory at `.pstdio/tickets/<ticket-shorthand>/` when missing.
4. Build YAML frontmatter from the planner ticket fields and prepend it to the ticket body content (replacing any existing frontmatter). See [Frontmatter Fields](#frontmatter-fields).
5. Write the result to `.pstdio/tickets/<ticket-shorthand>/ticket.md`.
6. Fetch all files linked to the ticket in planner storage and write them to `.pstdio/tickets/<ticket-shorthand>/files/` (supporting files).
7. If a target file path already exists and `--force` is not set, fail without overwriting that file.

#### Without `--id`

1. Must be run inside a linked project.
2. Fetch all non-archived tickets for the project from planner extension storage.
3. For each ticket, perform the same steps as the single-ticket pull (steps 3–7 above).
4. Log a summary of how many tickets were pulled.

#### Frontmatter Fields

The following fields are always written:

| Field     | Source                                  |
| --------- | --------------------------------------- |
| `created` | Creation timestamp from planner storage |

The following fields are included only when non-null:

| Field            | Source                                |
| ---------------- | ------------------------------------- |
| `status`         | Status name (resolved from ID)        |
| `parent_id`      | `parent_id` from planner storage      |
| `depends_on`     | `depends_on` from planner storage     |
| `parallelizable` | `parallelizable` from planner storage |
| `blocked_reason` | `blocked_reason` from planner storage |

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

- `"Not inside a Prompt Studio project. Run 'pst projects create' first."`: no `.pstdio/config.json` found.
- `"Ticket not found: <ticket-shorthand>"`: the ticket does not exist in planner storage (single-ticket mode).
- `"Local file already exists: <path>. Use --force to overwrite."`: local file conflict during pull.

---

## `pst tickets files`

### Usage

```sh
pst tickets files --id <ticket-shorthand> [--project-id <project-id>]
```

### Flags

| Flag           | Type     | Required | Description                                                                 |
| -------------- | -------- | -------- | --------------------------------------------------------------------------- |
| `--id`         | `string` | yes      | The ticket shorthand (e.g. `PS-12`).                                        |
| `--project-id` | `string` | no       | Target project. Defaults to the current project from `.pstdio/config.json`. |

### Behavior

1. Resolve the project: use `--project-id` if provided, otherwise fall back to `.pstdio/config.json`.
2. Resolve the ticket by shorthand from planner storage.
3. List files linked to the ticket in planner storage.
4. If running inside a linked project, list local files under `.pstdio/tickets/<ticket-shorthand>/files/`.
5. Output a merged view showing whether each file exists in planner storage, locally, or both. When running outside a linked project, the Local column is always `–` .

### Output

```text
File Name          Stored   Local   Local Path
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
- `"Ticket not found: <ticket-shorthand>"`: the ticket does not exist in planner storage.

---

## `pst tickets workspaces`

### Usage

```sh
pst tickets workspaces --id <ticket-shorthand> [--project-id <project-id>]
```

### Flags

| Flag           | Type     | Required | Description                                                                 |
| -------------- | -------- | -------- | --------------------------------------------------------------------------- |
| `--id`         | `string` | yes      | The ticket shorthand (e.g. `PS-12`).                                        |
| `--project-id` | `string` | no       | Target project. Defaults to the current project from `.pstdio/config.json`. |

### Behavior

1. Resolve the project: use `--project-id` if provided, otherwise fall back to `.pstdio/config.json`.
2. Resolve the ticket by shorthand from planner storage.
3. List active host workspaces linked to the planner ticket.
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
- `"Ticket not found: <ticket-shorthand>"`: the ticket does not exist in planner storage.

---

## `pst tickets worktrees list`

### Usage

```sh
pst tickets worktrees list --id <ticket-shorthand> [--project-id <project-id>] [--json]
```

### Flags

| Flag           | Type      | Required | Description                                                                 |
| -------------- | --------- | -------- | --------------------------------------------------------------------------- |
| `--id`         | `string`  | yes      | The ticket shorthand (e.g. `PS-12`).                                        |
| `--project-id` | `string`  | no       | Target project. Defaults to the current project from `.pstdio/config.json`. |
| `--json`       | `boolean` | no       | Output as JSON rows.                                                        |

### Behavior

1. Resolve the project: use `--project-id` if provided, otherwise fall back to `.pstdio/config.json`.
2. Resolve the ticket by shorthand from planner storage.
3. List active workspaces linked to the ticket.
4. Keep only rows that have a non-null `worktree_path`.

### Output

```text
Workspace   Branch               Path
PS-12/A1    workspace/PS-12/A1   /repo/.pstdio/workspaces/PS-12/A1
PS-12/A2    workspace/PS-12/A2   /repo/.pstdio/workspaces/PS-12/A2
```

If the ticket has no active worktrees:

```text
No worktrees found for ticket PS-12
```

### Errors

- `"No project specified. Provide --project-id or run inside a linked project."`: no `--project-id` flag and no `.pstdio/config.json` found.
- `"Project not found: <project-id>"`: the given project ID does not exist.
- `"Ticket not found: <ticket-shorthand>"`: the ticket does not exist in planner storage.

---

## `pst tickets worktrees remove-all`

### Usage

```sh
pst tickets worktrees remove-all --id <ticket-shorthand> [--project-id <project-id>]
```

### Flags

| Flag           | Type     | Required | Description                                                                 |
| -------------- | -------- | -------- | --------------------------------------------------------------------------- |
| `--id`         | `string` | yes      | The ticket shorthand (e.g. `PS-12`).                                        |
| `--project-id` | `string` | no       | Target project. Defaults to the current project from `.pstdio/config.json`. |

### Behavior

1. Resolve the project and ticket.
2. List active workspaces linked to the ticket.
3. For each workspace with a worktree path, remove the git worktree and branch.
4. Continue on individual failures and report total removals.

### Output

```text
Removed 2 worktree(s) for ticket PS-12
```

If the ticket has no active worktrees:

```text
No worktrees found for ticket PS-12
```

### Errors

- `"Not inside a git repository."`: command is run outside a git repository.
- `"Not inside a Prompt Studio project. Run 'pst projects create' first."`: no project config is available.
- `"No project specified. Provide --project-id or run inside a linked project."`: no `--project-id` flag and no `.pstdio/config.json` found.
- `"Project not found: <project-id>"`: the given project ID does not exist.
- `"Ticket not found: <ticket-shorthand>"`: the ticket does not exist in planner storage.

---

## `pst tickets list`

### Usage

```sh
pst tickets list [--project-id <project-id>] [--status <status>] [--tag <tag>...] [--archived] [--draft] [--parent-id <parent-id>]
```

### Flags

| Flag           | Type       | Required | Description                                                                 |
| -------------- | ---------- | -------- | --------------------------------------------------------------------------- |
| `--project-id` | `string`   | no       | List tickets for a specific project. Defaults to the current project.       |
| `--status`     | `string`   | no       | Filter by status name.                                                      |
| `--tag`        | `string[]` | no       | Filter by tag. Repeatable. Tickets matching **any** given tag are returned. |
| `--archived`   | `boolean`  | no       | Include archived tickets. Excluded by default.                              |
| `--draft`      | `boolean`  | no       | Include draft tickets. Excluded by default.                                 |
| `--parent-id`  | `string`   | no       | Filter by parent ticket shorthand. Returns only sub-tickets.                |

### Behavior

1. If `--project-id` is not provided, use the project from `.pstdio/config.json`.
2. Fetch all non-deleted tickets for the project from planner storage.
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

## `pst tickets update`

### Usage

```sh
pst tickets update --id <ticket-shorthand> [--project-id <project-id>] [--status <status>] [--tag <tag>...] [--parent-id <parent-id>] [--no-parent-id]
```

### Flags

| Flag             | Type       | Required | Description                                                                   |
| ---------------- | ---------- | -------- | ----------------------------------------------------------------------------- |
| `--id`           | `string`   | yes      | The ticket shorthand (e.g. `PS-12`).                                          |
| `--project-id`   | `string`   | no       | Target project. Defaults to the current project from `.pstdio/config.json`.   |
| `--status`       | `string`   | no       | New status name for the ticket. Must match an existing status in the project. |
| `--tag`          | `string[]` | no       | Replace current tags with the given set. Repeatable.                          |
| `--parent-id`    | `string`   | no       | Parent ticket shorthand or raw ticket ID.                                     |
| `--no-parent-id` | `boolean`  | no       | Clear `parent_id` on the ticket. Cannot be used with `--parent-id`.           |

### Behavior

1. Resolve the project: use `--project-id` if provided, otherwise fall back to `.pstdio/config.json`.
2. Update ticket properties in planner storage. `--status`, `--tag`, and parent changes are supported — content and files are updated via `tickets save`.
3. If `--status` is provided, look up the status by name and assign its ID.
4. If `--tag` is provided, replace the current tag assignments with the new set.
5. If `--parent-id` is provided, resolve it to a canonical ticket ID and set `parent_id`.
6. If `--no-parent-id` is provided, set `parent_id` to `null`.
7. If both `--parent-id` and `--no-parent-id` are provided, fail with a validation error.

### Output

```text
Updated ticket PS-12
```

### Errors

- `"No project specified. Provide --project-id or run inside a linked project."`: no `--project-id` flag and no `.pstdio/config.json` found.
- `"Project not found: <project-id>"`: the given project ID does not exist.
- `"Ticket not found: <ticket-shorthand>"`: the ticket does not exist in planner storage.
- `"Status not found: <status>"`: the given status name does not exist in the project.
- `"Tag not found: <tag>"`: the given tag does not exist in the project.
- `"Parent ticket not found: <parent-id>"`: the given parent ticket shorthand or ID does not resolve.
- `"Cannot combine --parent-id with --no-parent-id"`: mutually exclusive parent flags were used together.

---

## `pst tickets implement`

### Usage

```sh
pst tickets implement --id <ticket-shorthand> [--project-id <project-id>]
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
- `"Ticket not found: <ticket-shorthand>"`: the ticket does not exist in planner storage.
- `"No agent configured. Run 'pst agents setup' first."`: no default agent is set up.

---

## `pst tickets delete`

### Usage

```sh
pst tickets delete --id <ticket-shorthand> [--project-id <project-id>]
```

### Flags

| Flag           | Type     | Required | Description                                                                 |
| -------------- | -------- | -------- | --------------------------------------------------------------------------- |
| `--id`         | `string` | yes      | The ticket shorthand (e.g. `PS-12`).                                        |
| `--project-id` | `string` | no       | Target project. Defaults to the current project from `.pstdio/config.json`. |

### Behavior

1. Resolve the project: use `--project-id` if provided, otherwise fall back to `.pstdio/config.json`.
2. Resolve the ticket by shorthand from planner storage.
3. Soft-delete the ticket in planner storage.
4. If running inside a linked project, remove the local ticket directory at `.pstdio/tickets/<ticket-shorthand>/` if it exists.

### Output

```text
Deleted ticket PS-12
```

### Errors

- `"No project specified. Provide --project-id or run inside a linked project."`: no `--project-id` flag and no `.pstdio/config.json` found.
- `"Project not found: <project-id>"`: the given project ID does not exist.
- `"Ticket not found: <ticket-shorthand>"`: the ticket does not exist in planner storage.

---

## `pst tickets archive`

### Usage

```sh
pst tickets archive --id <ticket-shorthand> [--project-id <project-id>]
```

### Flags

| Flag           | Type     | Required | Description                                                                 |
| -------------- | -------- | -------- | --------------------------------------------------------------------------- |
| `--id`         | `string` | yes      | The ticket shorthand (e.g. `PS-12`).                                        |
| `--project-id` | `string` | no       | Target project. Defaults to the current project from `.pstdio/config.json`. |

### Behavior

1. Resolve the project: use `--project-id` if provided, otherwise fall back to `.pstdio/config.json`.
2. Resolve the ticket by shorthand from planner storage.
3. Set `archived=true` on the ticket in planner storage.
4. Archive all linked active workspaces for the ticket.
5. For each archived workspace, archive the linked session when present.
6. For each archived workspace, remove the local worktree directory when it exists.
7. Archived tickets are excluded from `tickets list` by default (use `--archived` to include them).

### Output

```text
Archived ticket PS-12
```

### Errors

- `"No project specified. Provide --project-id or run inside a linked project."`: no `--project-id` flag and no `.pstdio/config.json` found.
- `"Project not found: <project-id>"`: the given project ID does not exist.
- `"Ticket not found: <ticket-shorthand>"`: the ticket does not exist in planner storage.
- `"Ticket already archived: <ticket-shorthand>"`: the ticket is already archived.

---

## Local Side Effects

| Path                                               | Description                                                                                                            |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `.pstdio/tickets/<shorthand>/ticket.md`            | Local ticket file created by `write`/`pull`, read by `save`.                                                           |
| `.pstdio/tickets/<shorthand>/files/`               | Supporting files (research, schemas, PRDs) written by `pull`, read by `save`/`files`.                                  |
| `.pstdio/tickets/<shorthand>/files/<filename>`     | Individual supporting files synced between local project and planner storage.                                          |
| `.pstdio/reports/<name>/report.md`                 | Workspace report summary for agent-produced validation, review, test, or implementation evidence.                     |
| `.pstdio/reports/<name>/files/<filename>`          | Report supporting artifact such as test output, build logs, screenshots, traces, or review evidence.                  |
| `.pstdio/workspaces/<workspace-shorthand>/`        | Git worktree path referenced by `pst tickets workspaces` and removed when ticket archival cascades workspace archival. |
