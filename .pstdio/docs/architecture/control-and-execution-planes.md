# Control and Execution Planes

Prompt Studio intentionally splits orchestration from Git execution into two planes:

- **Control plane (API-managed):** project/workspace/session lifecycle,
  extension configuration, and API-dispatched lifecycle automation. Planner
  tickets are extension-owned state executed inside this control plane.
- **Execution plane (repo-hosted):** Git operations execute wherever the repository/worktree actually exists.

This split explains why local projects still run Git commands on the developer machine even though lifecycle state is tracked through the API.

## Current architecture

```
                  Control plane (always API)
┌───────────┐      HTTP/SSE      ┌───────────────┐
│    CLI    │ ─────────────────► │   pstdio-api  │
└─────┬─────┘                    └───────┬───────┘
      │                                  │
      │                                  │ owns lifecycle + metadata
      │                                  ▼
      │                            ┌──────────────┐
      │                            │  pstdio-db   │
      │                            └──────────────┘
      │
      │ execution request (merge/delete/commit/rebase)
      ▼
┌────────────────────────────────────────────────────────────┐
│ Execution plane (where repo/worktree is mounted)          │
│ - local mode: developer machine                            │
│ - remote mode: provider workspace VM/container             │
└────────────────────────────────────────────────────────────┘
```

## What runs in each plane

| Concern                                                         | Plane             | Current owner                      |
| --------------------------------------------------------------- | ----------------- | ---------------------------------- |
| Session state changes (`in_progress`, `completed`, etc.)        | Control           | API                                |
| Project/workspace/session record persistence                    | Control           | API + DB                           |
| Planner ticket/status/tag persistence                           | Control           | `pstdio-planner` extension storage |
| Extension configuration read/write                              | Control           | API                                |
| Worktree Git operations (`merge`, `delete`, `commit`, `rebase`) | Execution         | CLI + `pstdio-wt` in local mode    |
| Extension event and command middleware dispatch                 | Control           | API + `pstdio-extensions`          |
| `on-agent-ready` completion-triggered hook                      | Control-triggered | API-managed completion flow        |

## Why the split exists

### Local mode (today)

In local mode, the repository and worktrees live on the developer machine. Lifecycle operations that manipulate those Git objects therefore execute locally through the CLI and `pstdio-wt`.

- API remains the source of truth for core metadata/state; planner remains the source of truth for planner ticket metadata.
- API does not own local Git command execution.
- Worktree-local callbacks follow the local lifecycle action environment.

See also: `architecture/worktrees.md` and `architecture/local-and-remote.md`.

### Remote mode

In remote mode, a workspace provider supplies an opaque remote execution target. A compatible extension harness receives that target for session start, resume, reattach, and message reads. It reaches its remote control plane through a host-managed named connection. The execution plane moves to the provider environment, while control plane responsibilities stay API-managed.

- Worktree-local callbacks move with the lifecycle action to server-side.
- API still owns record/state orchestration.

See also: `architecture/local-and-remote.md`.
See also: `architecture/remote-execution-and-automation.md`.

## Lifecycle Automation Locality Rule

Extension automation and Git execution have separate locality rules:

1. State-backed extension middleware and event handlers run in the API-controlled extension runtime.
2. Git callbacks that wrap local worktree operations run wherever the repo/worktree is present.
3. If remote mode moves Git execution server-side, those Git callbacks move with it.

This keeps filesystem-sensitive behavior aligned with Git context while keeping stateful automation in the API boundary.

## `on-agent-ready` nuance

`on-agent-ready` is tied to session completion logic, which is currently API-managed. That means its trigger point is determined by API session lifecycle semantics, even when other Git lifecycle actions execute locally.

See `architecture/sessions.md` for completion behavior.

## Alternative: API-only Git Execution Model

A stricter model is possible: route all Git lifecycle execution through the API only. That would require moving local lifecycle operations behind API execution/proxying so filesystem-sensitive callbacks always occur in the API-controlled runtime.

Tradeoff summary:

- **Pros:** single execution authority, simpler audit boundary.
- **Cons:** additional proxying/infrastructure for local repos, tighter coupling between local filesystem operations and API runtime.

## Rules

1. **Control plane is always API-mediated.** Lifecycle state and records must be persisted through API flows.
2. **Execution plane follows repo locality.** Git commands run where the repo/worktree is present.
3. **Extension automation runs in the control plane.** Middleware and event handlers execute in the API-owned extension runtime.
4. **`on-agent-ready` is lifecycle-completion based.** Its trigger remains part of API-managed session completion.
