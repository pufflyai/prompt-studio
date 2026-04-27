# Control and Execution Planes

Prompt Studio separates API-owned project state from repo-local execution.

- **Control plane (API-managed):** project records, tickets, statuses, sessions, workspace metadata, extension storage, activity, sync, and stateful extension command execution.
- **Execution plane (repo-hosted):** Git operations, harness processes, and repo-context artifact IO that must run where the repository exists.

This split does not permit client-side DB access. `pstdio-api` remains the only database owner.

## Architecture

```txt
                  Control plane (API owner)
┌───────────┐      HTTP/SSE      ┌───────────────┐
│  Clients  │ ─────────────────► │   pstdio-api  │
└─────┬─────┘                    └───────┬───────┘
      │                                  │
      │                                  │ owns state + metadata
      │                                  ▼
      │                            ┌──────────────┐
      │                            │  pstdio-db   │
      │                            └──────────────┘
      │
      │ repo-local operation
      ▼
┌────────────────────────────────────────────────────────────┐
│ Execution plane (where repo/workspace is mounted)          │
│ - local mode: developer machine                            │
│ - remote mode: server workspace VM/container               │
└────────────────────────────────────────────────────────────┘
```

## Ownership

| Concern | Plane | Owner |
| --- | --- | --- |
| Session state | Control | API |
| Ticket/status/tag state | Control | API services behind extension contracts |
| Workspace metadata | Control | API |
| Extension command execution that persists state | Control | API + `pstdio-extensions` |
| Extension storage, templates, skills, activity, sync | Control | API + DB/storage |
| Git operations | Execution | CLI or remote workspace runner |
| Repo-context artifact reads/writes | Execution | Artifact mount owner, path-normalized by kernel |
| Harness process start/send/stop | Execution | Harness provider extension |

## Local Mode

In local mode, repositories and workspaces live on the developer machine. Git and artifact operations execute locally, then report persisted state through API services.

Rules:

1. Local code may read and write repo-context artifacts through approved mounts.
2. Local code must not open the DB or construct DB services.
3. Any metadata, status, activity, sync, file-storage, session, workspace, or extension-storage mutation calls the API.

## Remote Mode

In remote mode, the execution plane moves to a server-side workspace environment. The control plane stays the same: API services still own state and business rules.

The same extension contracts apply in both modes. Only the execution location changes.

## Extension Events and Commands

Lifecycle customization is modeled with extension commands and extension events.

- Commands are the executable primitive for CLI, UI, automation, and event handlers.
- Events are facts emitted by the kernel or by the extension that owns a workflow.
- Blocking behavior belongs in command validation or explicit policy checks.

## Rules

1. **Control plane is always API-mediated.** Durable project state must be persisted through API flows.
2. **Execution plane follows repo locality.** Git and repo-context artifact work run where the repo exists.
3. **Stateful extension commands run through API execution.** CLI metadata can be local, but persisted behavior is API-owned.
4. **Extension contracts own workflow semantics.** Ticket, planner, workspace, template, skill, and harness behavior is not hard-coded into the SDK.
