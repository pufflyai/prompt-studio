# Prompt Studio CLI reference

Run `pst --help`, `pst <group> --help`, or `pst <group> <command> --help` for the options available in the installed version.

## Runtime

```sh
pst [--api-port <port>] [--dashboard-port <port>] [--open-browser <boolean>]
pst serve [--port <port>] [--host <host>]
pst close [--force]
pst logs [--lines <count>] [--path]
```

`pst` starts the runtime and dashboard. Detached runtimes require a loopback host.

## Projects

```sh
pst projects create [name] [--repo <path>...]
pst projects link --project-id <id>
pst projects unlink
pst projects list
pst projects view [--project-id <id>]
pst projects repos [--project-id <id>]
pst projects delete <project-id>
```

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
pst workspaces create [--base <ref>] [--provider <id>] [--params <json>]
pst workspaces list [--json]
pst workspaces merge --id <id> [--delete-workspace]
pst workspaces delete --id <id>
```

Core workspace creation is standalone. Planner creates ticket-linked workspaces through managed attempts.

## Extensions

```sh
pst extensions add <source> [--name <name>] [--force] [--skip-install] [--branch <branch>]
pst extensions check [--json]
pst extensions dev <source> [--name <name>]
```

`add` installs an extension by catalog name or local folder. Use `--branch` only when developing against a branch. `dev` watches a local source, validates it, installs dependencies when needed, and refreshes the enabled project instance.

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

`reports write` returns paths for the report and its evidence files. Edit them, then use `reports save`.

## Troubleshooting

| Problem | Command or check |
| --- | --- |
| Project is not linked | Run `pst projects list`, then `pst projects link --project-id <id>`. |
| Skills are missing | Run `pst agents install-skills <agent-id>`. |
| Extensions fail validation | Run `pst extensions check`, then inspect the diagnostics. |
| Runtime is unreachable | Run `pst serve`, then `pst logs`. |
| Workspace cleanup failed | Run `pst workspaces list`, then remove the exact workspace when its work is safe. |
