---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# Product Requirements Document: CLI Templates

## Summary

The `pstdio templates` command group manages project-scoped templates and writes templates to docs or ticket targets.

## Command Summary

| Command | Purpose |
| ------- | ------- |
| `pstdio templates list` | List templates for the current project. |
| `pstdio templates create` | Create a template from file or stdin. |
| `pstdio templates update` | Update content and/or default status for a template. |
| `pstdio templates delete` | Delete a template. |
| `pstdio templates write` | Materialize a template into `.pstdio/docs/...` or `.pstdio/tickets/...`. |

## Detailed Behavior

## `pstdio templates list`

### Usage

```sh
pstdio templates list
```

Prints `Name`, `Type`, and `Default` columns. If no templates exist, prints `No templates found.`.

## `pstdio templates create`

### Usage

```sh
pstdio templates create --name <name> --type <prompt|ticket|document> --file <path|-> [--default]
```

### Notes

- Valid types are `prompt`, `ticket`, and `document`.
- `--file -` reads from stdin.

## `pstdio templates update`

### Usage

```sh
pstdio templates update --name <name> [--file <path|->] [--default]
```

### Notes

- If `--file` is omitted, only metadata (such as default) is updated.
- `--file -` reads updated content from stdin.

## `pstdio templates delete`

### Usage

```sh
pstdio templates delete --name <name>
```

## `pstdio templates write`

### Usage

```sh
pstdio templates write --name <template-name> --target <target>
```

### Target Rules

- `docs/<path>` writes `.pstdio/docs/<path>.md` and updates `.pstdio/docs/navigation.json`.
- `<ticket-shorthand>` writes `.pstdio/tickets/<ticket-shorthand>/ticket.md`.
- Ticket templates cannot target docs paths.

## Errors

| Error | Cause |
| ----- | ----- |
| `Invalid type: <type>. Must be 'prompt', 'ticket', or 'document'.` | Invalid `--type` on create. |
| `Template not found: <name>` | Missing template on write. |
| `Ticket templates cannot target docs. Use a docs template instead.` | Ticket template used with `docs/<path>` target. |
| `Ticket not found: <shorthand>` | Ticket target path does not exist locally. |

## Verification & Evidence

- **Commands to run**: `for f in list create update delete write; do sed -n '1,240p' packages/pstdio/src/adapters/cli/commands/templates/$f.ts; done`
- **Expected evidence**: Command names, accepted types, and target rules match this page.
- **Where to find artifacts**: `packages/pstdio/src/adapters/cli/commands/templates/`
