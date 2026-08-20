---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# CLI templates

Templates are Markdown files with `{{VARIABLE}}` placeholders. Core Prompt Studio and enabled extensions can contribute template types.

## Commands

```sh
pst templates list
pst templates create --name <name> --type <type> --file <path|-> [--default]
pst templates update --name <name> [--file <path|->] [--default]
pst templates write --name <name> (--target <path> | --ticket <ticket-id>) [--var KEY=value...]
pst templates delete --name <name>
```

`create` accepts any template type registered by the default catalog or an enabled extension. Use `-` as the file path to read template content from standard input.

`write` requires exactly one destination. `--target` writes to a path. `--ticket` replaces the local ticket body while preserving its title. Repeat `--var` for more than one placeholder.

```sh
pst templates write --name adr --target .pstdio/docs/adrs/0001-example.md --var TITLE="Example decision"
```

Run `pst templates <command> --help` for current options.
