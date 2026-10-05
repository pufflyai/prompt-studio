# Overview

The `pst` command starts the Prompt Studio workbench and manages projects, sessions, workspaces, and extensions. Enabled extensions can add more command groups.

Run `pst --help`, `pst <group> --help`, or `pst <group> <command> --help` to see the options in your installed version.

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
