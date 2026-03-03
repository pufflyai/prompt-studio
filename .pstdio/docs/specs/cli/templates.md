# CLI Spec: `pstdio templates`

## Purpose

Manage document and ticket templates within a pstdio project. Templates are reusable markdown files with placeholder tokens that get substituted when writing new documents or tickets.

---

## Bundled Templates

Projects are initialized with the following default templates:

| Name        | Type   | Description                                                                 |
| ----------- | ------ | --------------------------------------------------------------------------- |
| `ticket`    | ticket | Standard ticket template.                                                   |
| `proposal`  | ticket | Proposal template with goals, scenarios, and implementation outline.        |
| `spec`      | docs   | CLI spec template with usage, flags, behavior, output, and errors sections. |
| `adr`       | docs   | Architecture Decision Record template.                                      |
| `cookbook`  | docs   | Cookbook / how-to guide template.                                           |
| `review-me` | docs   | Review checklist template with open questions.                              |

---

## `pstdio templates write`

### Usage

```sh
pstdio templates write --name <template-name> --target <target>
```

### Flags

| Flag       | Type     | Required | Description                                                                                                             |
| ---------- | -------- | -------- | ----------------------------------------------------------------------------------------------------------------------- |
| `--name`   | `string` | yes      | Name of the template to use.                                                                                            |
| `--target` | `string` | yes      | Where to write the output. Either a docs path (e.g. `docs/specs/cli/new-command`) or a ticket shorthand (e.g. `PS-12`). |

### Behavior

1. Must be run inside a linked project (`.pstdio/config.json` must exist).
2. Look up the template by name. Fail if it does not exist.
3. Replace all placeholder tokens in the template (see [Template Placeholders](#template-placeholders)).
4. Validate the template type against the target:
   - **docs** templates can target both `docs/<path>` and `<ticket-shorthand>`.
   - **ticket** templates can only target `<ticket-shorthand>`. Targeting `docs/<path>` with a ticket template is an error.
5. Write the output based on `--target`:
   - **`docs/<path>`**: write the file to `.pstdio/docs/<path>.md` and register it in `navigation.json`.
   - **`<ticket-shorthand>`**: write the file into the ticket directory at `.pstdio/tickets/<ticket-shorthand>/`. The ticket must already exist (created via `tickets write` or `tickets create`).

### Output

When targeting docs:

```text
Wrote template "spec" to .pstdio/docs/specs/cli/new-command.md
```

When targeting a ticket:

```text
Wrote template "proposal" to .pstdio/tickets/PS-12/ticket.md
```

### Errors

- `"Not inside a pstdio project. Run 'pstdio projects create' first."`: no `.pstdio/config.json` found.
- `"Template not found: <template-name>"`: the given template name does not exist.
- `"Ticket templates cannot target docs. Use a docs template instead."`: a ticket-type template was used with a `docs/<path>` target.
- `"Ticket not found: <ticket-shorthand>"`: the target ticket does not exist.

---

## `pstdio templates list`

### Usage

```sh
pstdio templates list
```

### Flags

None.

### Behavior

1. Must be run inside a linked project.
2. Fetch all templates for the current project from the database.

### Output

```text
Name          Type      Default
ticket        ticket    *
proposal      ticket
spec          docs      *
adr           docs
cookbook      docs
review-me     docs
```

- `Default`: `*` marks the default template for that type.

If no templates exist:

```text
No templates found.
```

### Errors

- `"Not inside a pstdio project. Run 'pstdio projects create' first."`: no `.pstdio/config.json` found.

---

## `pstdio templates create`

### Usage

```sh
pstdio templates create --name <name> --type <type> --file <path>
```

### Flags

| Flag        | Type      | Required | Description                                                                          |
| ----------- | --------- | -------- | ------------------------------------------------------------------------------------ |
| `--name`    | `string`  | yes      | Unique template name within the project.                                             |
| `--type`    | `string`  | yes      | Template type: `ticket` or `docs`.                                                   |
| `--file`    | `string`  | yes      | Path to a markdown file containing the template content. Use `-` to read from stdin. |
| `--default` | `boolean` | no       | Set as the default template for its type.                                            |

### Behavior

1. Must be run inside a linked project.
2. Read the template content from the file at `--file`, or from stdin if `--file -`.
3. Create the template in the database, associated with the current project.
4. If `--default` is set, mark it as the default for its type and unset the previous default.

### Output

```text
Created template "bugfix" (ticket)
```

### Errors

- `"Not inside a pstdio project. Run 'pstdio projects create' first."`: no `.pstdio/config.json` found.
- `"Template already exists: <name>"`: a template with this name already exists in the project.
- `"Invalid type: <type>. Must be 'ticket' or 'docs'."`: invalid template type.

---

## `pstdio templates delete`

### Usage

```sh
pstdio templates delete --name <name>
```

### Flags

| Flag     | Type     | Required | Description                     |
| -------- | -------- | -------- | ------------------------------- |
| `--name` | `string` | yes      | Name of the template to delete. |

### Behavior

1. Must be run inside a linked project.
2. Soft-delete the template by setting `deleted_at`. The template is hidden from `list` and `write` queries but data is retained.
3. If the deleted template was the default for its type, no new default is assigned automatically.

### Output

```text
Deleted template "bugfix"
```

### Errors

- `"Not inside a pstdio project. Run 'pstdio projects create' first."`: no `.pstdio/config.json` found.
- `"Template not found: <name>"`: the template does not exist or is already deleted.

---

## `pstdio templates update`

### Usage

```sh
pstdio templates update --name <name> [--file <path>] [--default]
```

### Flags

| Flag        | Type      | Required | Description                                                                    |
| ----------- | --------- | -------- | ------------------------------------------------------------------------------ |
| `--name`    | `string`  | yes      | Name of the template to update.                                                |
| `--file`    | `string`  | no       | Path to a markdown file with new template content. Use `-` to read from stdin. |
| `--default` | `boolean` | no       | Set this template as the default for its type.                                 |

### Behavior

1. Must be run inside a linked project.
2. Look up the template by name. Fail if it does not exist.
3. If `--file` is provided, replace the template content with the file contents.
4. If `--default` is set, mark it as the default for its type and unset the previous default.

### Output

```text
Updated template "bugfix"
```

### Errors

- `"Not inside a pstdio project. Run 'pstdio projects create' first."`: no `.pstdio/config.json` found.
- `"Template not found: <name>"`: the template does not exist or is already deleted.

---

## Template Placeholders

Same placeholder tokens as described in the [tickets spec](./tickets.md#template-placeholders). The CLI replaces all occurrences before writing the file.

| Placeholder        | Replaced With                                                    | Source                      |
| ------------------ | ---------------------------------------------------------------- | --------------------------- |
| `{{TICKET_ID}}`    | The ticket shorthand (e.g. `PS-12`), or empty if targeting docs. | Auto-generated / `--target` |
| `{{TICKET_TITLE}}` | The ticket title, or the template name if targeting docs.        | Ticket record / fallback    |
| `{{CREATED_AT}}`   | ISO 8601 timestamp at creation time.                             | Auto-generated              |
| `{{USER_PROMPT}}`  | User prompt if available, or empty string.                       | Ticket record / empty       |
| `{{PARENT_ID}}`    | Parent ticket shorthand if available, or empty string.           | Ticket record / empty       |

Additional template-specific placeholders (e.g. `{{COMMAND}}` in the spec template) are passed via extra flags and matched by name.

---

## Local Side Effects

| Path                                    | Description                                                            |
| --------------------------------------- | ---------------------------------------------------------------------- |
| `.pstdio/docs/<path>.md`                | Document file created when `--target docs/<path>`.                     |
| `.pstdio/docs/navigation.json`          | Updated to include the new document when `--target docs/<path>`.       |
| `.pstdio/tickets/<shorthand>/ticket.md` | Ticket file created or overwritten when `--target <ticket-shorthand>`. |
