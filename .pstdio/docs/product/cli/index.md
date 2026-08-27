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
| `pst agents` | Configure agents and install skills. |
| `pst sessions` | Run and inspect agent sessions. |
| `pst workspaces` | Manage standalone worktree-backed workspaces. |
| `pst templates` | Manage templates and write them to files. |
| `pst extensions` | Install, develop, and validate extensions. |
| `pst notifications` | Create and manage project notifications. |
| `pst inbox` | List pending project notifications. |
| `pst auth tokens` | Issue, list, and revoke scoped machine tokens. |
| `pst automation` | Create and inspect durable automation runs. |
| `pst connections check` | Run an extension's declared connection health check. |

## Command guides

- [Set up Prompt Studio](./setup.md)
- [Projects](./projects.md)
- [Agents](./agents.md)
- [Sessions](./sessions.md)
- [Workspaces](./workspaces.md)
- [Templates](./templates.md)
- [Notifications](./notifications.md)
- [Remote automation](./automation.md)
- [CLI output](./feedback.md)

Extension commands live with their extensions:

- [Planner CLI](../../../../extensions/pstdio-planner/docs/cli/index.md)
- [Reports CLI](../../../../extensions/pstdio-reports/README.md)
- [Extension Lab CLI](../../../../extensions/extension-lab/README.md)
