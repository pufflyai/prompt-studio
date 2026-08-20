---
status: "draft"
created: "2026-08-20T00:00:00Z"
---

# CLI notifications

Notifications let extensions and tools place project-scoped work in the Prompt Studio inbox.

## Commands

```sh
pst inbox [--project-id <id>] [--status <status>] [--priority <priority>] [--limit <count>]
pst notifications list [--project-id <id>] [--status <status>] [--priority <priority>] [--limit <count>]
pst notifications show <id> [--project-id <id>]
pst notifications send --project-id <id> --kind <kind> --title <title> [options]
pst notifications read <id> [--project-id <id>]
pst notifications done <id> [--project-id <id>]
pst notifications dismiss <id> [--project-id <id>]
pst notifications snooze <id> --until <time> [--project-id <id>]
```

`pst inbox` and `pst notifications list` show pending notifications. Comma-separate more than one status or priority filter.

`send` also accepts `--body`, `--priority`, `--target <type:id>`, and `--dedupe-key`.

`snooze --until` accepts an ISO timestamp or a relative duration such as `1h`.

Commands without `--project-id` use the project linked in `.pstdio/config.json`.

Run `pst notifications <command> --help` for current options.
