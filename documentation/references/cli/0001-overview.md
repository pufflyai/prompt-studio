---
status: "draft"
created: "2026-08-20T00:00:00Z"
---

# Prompt Studio CLI

The `pst` CLI starts the workbench and manages core Prompt Studio resources. Enabled extensions can add more command groups.

Run `pst --help`, `pst <group> --help`, or `pst <group> <command> --help` for the options available in your installed version.

## Core commands

| Command | Purpose |
| --- | --- |
| `pst` | Start the API and dashboard, then open the workbench. |
| `pst serve` | Start or reuse the local API runtime. |
| `pst close` | Stop the background API runtime. |
| `pst logs` | Read the local runtime log. |
| `pst projects` | Create, link, inspect, and remove projects. |
| `pst agents` | Discover harnesses and install skills. |
| `pst sessions` | Run and inspect agent sessions. |
| `pst workspaces` | Manage provider-backed workspaces. |
| `pst extensions` | Install, update, develop, and validate extensions. |
| `pst notifications` | Create and manage project notifications. |
| `pst inbox` | List pending project notifications. |
| `pst auth tokens` | Issue, list, and revoke scoped machine tokens. |
| `pst automation` | Create and inspect durable automation runs. |
| `pst connections check` | Run an extension's declared connection health check. |

## Command guides

- [Set up Prompt Studio](0003-setup.md)
- [Projects](0004-projects.md)
- [Agents](0002-agents.md)
- [Sessions](0006-sessions.md)
- [Workspaces](0005-workspaces.md)
- [Notifications](0008-notifications.md)
- [Remote automation](0007-automation.md)
- [CLI output](../../requirements/cli/0001-feedback.md)

Extension commands live with their extensions:

- [Planner CLI](../../../extensions/pstdio-planner/docs/cli/index.md)
- [Reports CLI](../../../extensions/pstdio-reports/README.md)
- [Extension Lab CLI](../../../extensions/extension-lab/README.md)
