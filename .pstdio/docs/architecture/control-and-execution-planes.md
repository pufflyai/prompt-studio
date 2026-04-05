# Control and Execution Planes

pstdio intentionally splits orchestration from Git execution into two planes:

- **Control plane (API-managed):** session lifecycle, ticket/workspace records, status transitions, and hook configuration read/write.
- **Execution plane (repo-hosted):** Git operations and plugin hooks execute wherever the repository/worktree actually exists.

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
      │ execution request (merge/delete/commit/rebase/hook)
      ▼
┌────────────────────────────────────────────────────────────┐
│ Execution plane (where repo/worktree is mounted)          │
│ - local mode: developer machine                            │
│ - remote mode (future): server workspace VM/container      │
└────────────────────────────────────────────────────────────┘
```

## What runs in each plane

| Concern                                                         | Plane             | Current owner                                   |
| --------------------------------------------------------------- | ----------------- | ----------------------------------------------- |
| Session state changes (`in_progress`, `completed`, etc.)        | Control           | API                                             |
| Ticket/workspace/session record persistence                     | Control           | API + DB                                        |
| Hook configuration read/write                                   | Control           | API                                             |
| Worktree Git operations (`merge`, `delete`, `commit`, `rebase`) | Execution         | CLI + `pstdio-wt` in local mode                 |
| Plugin hook execution                                           | Execution         | Same environment that executes lifecycle action |
| `on-agent-ready` completion-triggered hook                      | Control-triggered | API-managed completion flow                     |

## Why the split exists

### Local mode (today)

In local mode, the repository and worktrees live on the developer machine. Lifecycle operations that manipulate those Git objects therefore execute locally through the CLI and `pstdio-wt`.

- API remains the source of truth for metadata/state.
- API does not own local Git command execution.
- Hook execution follows the local lifecycle action environment.

See also: `architecture/worktrees.md` and `architecture/local-and-remote.md`.

### Remote mode (future)

In remote mode, the same lifecycle operations run where the remote workspaces live (server-side VM/container). The execution plane moves to the server environment, while control plane responsibilities stay API-managed.

- Hook execution moves with the lifecycle action to server-side.
- API still owns record/state orchestration.

See also: `architecture/local-and-remote.md`.

## Hook locality rule

Hook execution is co-located with lifecycle execution:

1. If lifecycle action runs locally, hook runs locally.
2. If lifecycle action runs server-side, hook runs server-side.

This keeps hook behavior aligned with filesystem and Git context (working tree, branch, repo-local scripts).

## `on-agent-ready` nuance

`on-agent-ready` is tied to session completion logic, which is currently API-managed. That means its trigger point is determined by API session lifecycle semantics, even when other Git lifecycle actions execute locally.

See `architecture/sessions.md` for completion behavior.

## Alternative: API-only hook execution model

A stricter model is possible: route all hook execution through the API only. That would require moving local lifecycle operations behind API execution/proxying so hook execution always occurs in the API-controlled runtime.

Tradeoff summary:

- **Pros:** single execution authority, simpler audit boundary.
- **Cons:** additional proxying/infrastructure for local repos, tighter coupling between local filesystem operations and API runtime.

## Rules

1. **Control plane is always API-mediated.** Lifecycle state and records must be persisted through API flows.
2. **Execution plane follows repo locality.** Git commands run where the repo/worktree is present.
3. **Hooks run with lifecycle actions.** Hook runtime matches lifecycle execution runtime.
4. **`on-agent-ready` is lifecycle-completion based.** Its trigger remains part of API-managed session completion.
