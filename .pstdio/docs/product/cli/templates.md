---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# Product Requirements Document: CLI Templates

## Summary

The `pst templates` command group manages project-scoped templates and writes templates to docs or ticket targets.

## Command Summary

| Command | Purpose |
| ------- | ------- |
| `pst templates list` | List templates for the current project. |
| `pst templates create` | Create a template from file or stdin. |
| `pst templates update` | Update content and/or default status for a template. |
| `pst templates delete` | Delete a template. |
| `pst templates write` | Render a template into a file path or ticket. |

## Detailed Behavior

## `pst templates list`

### Usage

```sh
pst templates list
```

Prints `Name`, `Type`, and `Default` columns. If no templates exist, prints `No templates found.`.

## `pst templates create`

### Usage

```sh
pst templates create --name <name> --type <prompt|ticket|document> --file <path|-> [--default]
```

### Notes

- Valid types are `prompt`, `ticket`, and `document`.
- `--file -` reads from stdin.

## `pst templates update`

### Usage

```sh
pst templates update --name <name> [--file <path|->] [--default]
```

### Notes

- If `--file` is omitted, only metadata (such as default) is updated.
- `--file -` reads updated content from stdin.

## `pst templates delete`

### Usage

```sh
pst templates delete --name <name>
```

## `pst templates write`

### Usage

```sh
pst templates write --name <template-name> (--target <path> | --ticket <shorthand>) [--var KEY=value ...]
```

### Modes

- `--target <path>` renders the template to a file path relative to the current directory (absolute paths are accepted). Parent directories are created. Any existing file at that path is overwritten.
- `--ticket <shorthand>` renders the template to `.pstdio/tickets/<shorthand>/ticket.md` and preserves the existing H1 title via the `TICKET_TITLE` placeholder.
- `--target` and `--ticket` are mutually exclusive. Exactly one is required.
- `--var KEY=value` (repeatable) supplies template placeholders. Ticket-specific placeholders (`TICKET_ID`, `TICKET_TITLE`) are only populated in `--ticket` mode.

## Errors

| Error | Cause |
| ----- | ----- |
| `Invalid type: <type>. Must be 'prompt', 'ticket', or 'document'.` | Invalid `--type` on create. |
| `Template not found: <name>` | Missing template on write. |
| `Ticket not found: <shorthand>` | `--ticket` shorthand has no local ticket directory. |
| `--target and --ticket are mutually exclusive.` | Both flags supplied to `write`. |
| `Exactly one of --target or --ticket is required.` | Neither flag supplied to `write`. |
| `Invalid --var format: "<entry>". Expected key=value.` | `--var` entry missing `=`. |

## Verification & Evidence

- **Commands to run**: `for f in list create update delete write; do sed -n '1,240p' packages/pstdio/src/adapters/cli/commands/templates/$f.ts; done`
- **Expected evidence**: Command names, accepted types, and target rules match this page.
- **Where to find artifacts**: `packages/pstdio/src/adapters/cli/commands/templates/`
