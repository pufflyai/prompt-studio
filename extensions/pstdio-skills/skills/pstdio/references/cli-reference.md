# Prompt Studio CLI reference

Run `pst --help`, `pst <group> --help`, or `pst <group> <command> --help` for the options available in the installed version.

## Runtime

```sh
pst [--api-port <port>] [--open-browser <boolean>]
pst serve [--port <port>] [--host <host>]
pst close [--force]
pst logs [--lines <count>] [--path]
```

`pst` starts the runtime and serves the dashboard on the API's own origin. Detached runtimes require a loopback host.

## Projects

```sh
pst projects create [name]
pst projects list
pst projects view [--project-id <id>]
pst projects delete <project-id>
```

The alpha.12 host requires a Git repository and accepts `--repo <folder>`. The alpha.13 host accepts ordinary folders and uses `--path <folder>`. Run `pst projects create --help` to check your installed host.

## Agents

```sh
pst agents list
pst agents setup <agent-id> [--global-skills]
pst agents install-skills <agent-id> [--global-skills]
```

## Sessions

```sh
pst sessions create --prompt <text> [--title <title>] [--workspace-id <id>] [--project-id <id>] [--agent <agent>] [--model <model>] [--attach <path>...] [--original-session-id <id>]
pst sessions list [--project-id <id>] [--status <status>] [--agent <agent>] [--workspace-id <id>] [--archived]
pst sessions view --id <id>
pst sessions follow-up --id <id> [--prompt <text> | --summary-of <id>] [--summary-format <brief|detailed>] [--summary-role <assistant|all>] [--agent <agent>] [--model <model>] [--attach <path>...]
pst sessions stream --id <id>
pst sessions approve --id <id> --approval-id <id>
pst sessions deny --id <id> --approval-id <id>
pst sessions stop --id <id>
pst sessions archive --id <id>
pst sessions resolve-session-id --agent <agent> --agent-session-id <id> [--cwd <path>] [--json]
```

## Workspaces

```sh
pst workspaces create --provider <id> [--params <json>]
pst workspaces list [--json]
pst workspaces merge --id <id> [--delete-workspace]
pst workspaces delete --id <id>
```

Core workspace creation is standalone. Link it to one or more tickets with `pst tickets link --id <ticket> --workspace <workspace>`. Planner also creates linked workspaces through managed attempts.

## Extensions

```sh
pst extensions add <source> [--name <name>] [--force] [--skip-install] [--branch <branch>]
pst extensions check [--json]
pst extensions dev <source> [--name <name>]
pst extensions update [name] [--project-id <id>]
```

`add` installs an extension by catalog name or local folder. Use `--branch` only when developing against a branch. `dev` watches a local source, validates it, installs dependencies when needed, and refreshes the enabled project instance. `update` asks the host to upgrade eligible project instances to the release paired with that host. It leaves local sources and enablement state alone.

## Notifications

```sh
pst inbox [--project-id <id>] [--status <status>] [--priority <priority>] [--limit <count>]
pst notifications list [--project-id <id>] [--status <status>] [--priority <priority>] [--limit <count>]
pst notifications show <id> [--project-id <id>]
pst notifications send --project-id <id> --kind <kind> --title <title> [--body <body>] [--priority <priority>] [--target <type:id>] [--dedupe-key <key>]
pst notifications read <id> [--project-id <id>]
pst notifications done <id> [--project-id <id>]
pst notifications dismiss <id> [--project-id <id>]
pst notifications snooze <id> --until <time> [--project-id <id>]
```

## Planner tickets

These aliases are available when the `pstdio-planner` extension is enabled.

```sh
pst tickets list [--status <status>] [--tags <tag>...] [--parent <id>] [--archived] [--draft]
pst tickets create [--title <title>] [--content <markdown>] [--status <status>] [--tags <tag>...] [--parent <id>]
pst tickets add [same options as create]
pst tickets panel --id <id>
pst tickets update --id <id> [--content <markdown>] [--status <status>] [--tags <tag>...] [--parent <id>] [--unlink-parent] [--blocked-reason <text>]
pst tickets link-review --id <id> --url <url> [--title <title>]
pst tickets archive --id <id>
pst tickets delete --id <id>
pst tickets write --title <title> [--status <status>] [--tags <tag>...] [--user-prompt <text>] [--parent <id>]
pst tickets save --id <id> [--status <status>]
pst tickets pull [--id <id>] [--force]
pst tickets files --id <id>
pst tickets implement --id <id> [--agent <agent>]
pst tickets link --id <id> (--workspace <workspace> | --session <session-id>)
pst tickets unlink --id <id> (--workspace <workspace> | --session <session-id>)
pst tickets workspaces --id <id>
pst tickets worktrees list --id <id>
pst tickets worktrees remove-all --id <id>
pst tickets proposal-refined --id <id>
```

`tickets save` reads the body, tags, parent, dependencies, and files from the local ticket tree.

## Planner statuses and tags

```sh
pst statuses list
pst statuses create --label <label> [--color <color>] [--icon <icon>] [--can-create] [--can-drag-in] [--can-drag-out] [--column-actions <json>]
pst statuses set-default --status <status>
pst statuses delete --status <status>

pst tags list
pst tags create --name <name> [--type <single_select|multi_select>]
pst tags delete --tag <tag>
```

## Reports

These aliases are available when the `pstdio-reports` extension is enabled.

```sh
pst reports write [--workspace <id>] [--kind <kind>] [--name <name>] --template <template> [--source <source>]
pst reports read --id <report-id>
pst reports save [--workspace <id>] [--name <name>]
pst reports delete [--workspace <id>] [--name <name>]
```

`reports write` returns absolute host paths in the default project folder for the report and its evidence files. Edit those paths, then use `reports save`. These paths do not refer to a remote workspace filesystem.

## Troubleshooting

| Problem | Command or check |
| --- | --- |
| Project is not linked | Run `pst projects create` from the selected folder (a Git repository on alpha.12). |
| Skills are missing | Run `pst agents install-skills <agent-id>`. |
| Extensions fail validation | Run `pst extensions check`, then inspect the diagnostics. |
| Runtime is unreachable | Run `pst serve`, then `pst logs`. |
| Workspace cleanup failed | Run `pst workspaces list`, then remove the exact workspace when its work is safe. |

## Shared board views

Use `pst views boards` to discover board IDs, fields, and current options. Use
`pst views list --board <boardId>` to inspect built-in and saved views. Create a
shared view with `pst views create --board <boardId> --title "Urgent bugs"
--filter priority=Urgent --filter type=Bug`. Filter values can be IDs or labels;
use IDs when a label is ambiguous. Commands print JSON. Use `--project-id` outside
a linked project folder.

Use `pst views update --id <viewId> --title "New name"` to edit a saved view and
`pst views delete --id <viewId>` to remove it. Duplicate a view with
`pst views create --board <boardId> --title "Copy" --copy-from <viewId>`.
Built-in views are read-only. Use `pst views set-default --board <boardId>
--id <viewId>` only when asked to change the shared project default; pass `none`
to clear it. Reorder saved views with `pst views reorder --board <boardId>
--ids <firstId>,<secondId>`. List removed boards' saved views with
`pst views list --orphaned` and delete them by ID.

Saved views and defaults are project data. Active selection and unsaved edits
stay local to each client. Old locally saved views are dropped. See the
[board view reference](https://github.com/pufflyai/prompt-studio/blob/main/documentation/references/cli/0009-board-views.md).
