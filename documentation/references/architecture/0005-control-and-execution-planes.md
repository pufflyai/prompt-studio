# Control and execution planes

The control plane owns accepted intent, permissions, lifecycle, and stored metadata. The execution plane runs work where its files or remote resources exist. They may share a machine without sharing responsibility.

## Current owners

| Operation | Owner |
| --- | --- |
| Project, workspace, session, and queue state | API domain services and database |
| Ticket and review policy | Planner extension commands and storage |
| Extension adoption and lifecycle dispatch | API extension runtime |
| Local worktree creation and removal | API workspace provider using `pstdio-wt` |
| Local workspace merge | CLI merge workflow using `pstdio-wt`, with API-managed workspace state |
| Agent execution | Selected harness acting on the workspace execution target |
| Remote files and execution | Workspace provider and compatible harness through declared capabilities/connections |

The CLI is not the sole owner of local Git. Workspace creation/deletion commands call the API, whose local provider performs those operations. Some CLI workflows, such as merge, still execute Git locally. Use the operation's implementation to locate its owner.

## Locality

A local filesystem operation runs on the machine that can access the workspace path. A remote workspace supplies an opaque provider reference and execution target. The host must not invent a local directory for remote work or allow an unsupported file/Git operation merely because a workspace record exists.

State-backed command middleware and hooks execute in the host extension runtime. Provider operations run through their declared execution boundary. Session lifecycle events are emitted by the session service; the removed `on-agent-ready` hook name is not a supported extension contract.

## Rules

1. Persist accepted lifecycle changes through the owning API or extension service.
2. Resolve workspace location and capabilities before execution.
3. Keep remote credentials in host-managed named connections.
4. Use one operation owner; do not repeat Git or hook effects in the client and provider.
5. Treat successful process exit, durable acceptance, and completed work as separate outcomes.

See [local and remote workspaces](0012-local-and-remote.md), [worktrees](0023-worktrees.md), [remote execution](0016-remote-execution-and-automation.md), and [sessions](0020-sessions.md).
