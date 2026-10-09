# Overview

The `pst` command starts the Prompt Studio workbench and manages projects, sessions, workspaces, and extensions. Enabled extensions can add more command groups.

Run `pst --help`, `pst <group> --help`, or `pst <group> <command> --help` to see the options in your installed version.

## Extension actions are CLI-ready

An extension can expose the same command behind a button, toolbar action, or menu through `pst`. Agents can discover the generated help and call the command with explicit flags. They do not need to reproduce the screen interaction.

Run inside the project folder, or pass `--project-id <project-id>` to an extension command. The available extension commands come from that project's enabled tools. For example, with Notes enabled:

```sh
pst pstdio-notes --help
pst pstdio-notes notes create --help
pst pstdio-notes notes create --title "Meeting notes" --json
```

A successful extension command normally prints its returned value as JSON. `--json` prints the full execution response, including `commandId` and `outcome`; check `outcome.ok` and read `outcome.value` on success. A failed or rejected execution exits with code 1. Core commands have their own output formats; check each command's help.

The extension author must declare CLI access and connect the UI action to the command. A custom webview button is not automatically a CLI command. See [Make actions CLI-ready](../../guides/extensions/0007-cli-ready-actions.md) for authoring and [Commands and processes](../extensions/0003-command-and-process-api.md#cli-contributions) for flags and aliases.

## Core commands

| Command | Purpose |
| --- | --- |
| `pst` | Start the API and dashboard, then open the workbench. |
| `pst serve` | Start or reuse the local API runtime. |
| `pst close` | Stop the background API runtime. |
| `pst logs` | Read the local runtime log. |
| `pst performance` | Print the desktop app's local performance snapshot as JSON, including the workbench frame rate (`frameRate`) and paused extensions (`pausedExtensionIds`). See [Developer tools](../../guides/0003-developer-tools.md). |
| `pst projects` | Create, link, inspect, and remove projects. |
| `pst agents` | Discover harnesses and install skills. |
| `pst sessions` | Run and inspect agent sessions. |
| `pst workspaces` | Create, merge, and remove provider-backed workspaces. |
| `pst extensions` | Install, update, develop, and check extensions. |
| `pst notifications` | Create and manage project notifications. |
| `pst inbox` | List pending project notifications. |
| `pst views` | Manage shared board views. |
| `pst auth tokens` | Issue, list, and revoke scoped machine tokens. |
| `pst automation` | Create and inspect durable automation runs. |
| `pst connections check` | Run an extension's declared connection health check. |

## Command pages

- [Runtime commands](0003-setup.md)
- [Projects](0004-projects.md)
- [Agents](0002-agents.md)
- [Sessions](0006-sessions.md)
- [Workspaces](0005-workspaces.md)
- [Notifications](0008-notifications.md)
- [Board views](0009-board-views.md)
- [Remote automation](0007-automation.md)

Extension commands are documented with their extensions:

- [Planner CLI](../../../extensions/pstdio-planner/docs/0004-cli.md)
- [Reports CLI](../../../extensions/pstdio-reports/README.md)
- [Extension Lab CLI](../../../extensions/extension-lab/README.md)

### Stream extension command output

Use `pst <namespace> <command> [params] --stream` for commands that declare streaming output. Standard output contains NDJSON: one `{ "type": "data", "data": ... }` line per chunk, followed by `{ "type": "end", "outcome": ... }`.

A success outcome exits with code 0. Other outcomes exit with code 1. Ctrl+C aborts the handler and exits with code 130. Without `--stream`, command output stays unchanged. A command without a stream declaration fails with `command_not_streamable`.
