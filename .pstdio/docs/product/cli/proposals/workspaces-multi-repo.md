---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# Product Requirements Document: CLI Workspaces Multi-Repo (Draft)

## Summary

This PRD captures the draft multi-repo workspace direction and intentionally does not describe shipped behavior.

## Detailed Behavior

Status: **DRAFT** (not implemented)

This document tracks the proposed multi-repo workspace model and intentionally does not define current CLI behavior.

---

## Goal

Support one logical workspace across multiple project repos, where each repo gets its own worktree under a shared workspace root.

---

## Proposed Terminology

- **Workspace root**: `~/.pstdio/workspaces/<workspace-shorthand>/`
- **Per-repo worktree**: `~/.pstdio/workspaces/<workspace-shorthand>/<repo.name>/`
- **Per-repo branch**: `workspace/<workspace-shorthand>` in each repo
- **Workspace shorthand**: `<ticket-shorthand>_A<n>`

---

## Proposed Path Model

All local paths are derived from workspace shorthand plus the project's repo list.

| Item                | Derivation                                            |
| ------------------- | ----------------------------------------------------- |
| Workspace root      | `~/.pstdio/workspaces/<workspace-shorthand>/`         |
| Repo `api` worktree | `~/.pstdio/workspaces/<workspace-shorthand>/api/`     |
| Repo `web` worktree | `~/.pstdio/workspaces/<workspace-shorthand>/web/`     |
| Workspace branch    | `workspace/<workspace-shorthand>` in each linked repo |

---

## Proposed Command Semantics

### `workspaces create`

- Resolve all repos linked to the project.
- Create workspace root directory once.
- For each repo, create branch + worktree in its repo-specific subdirectory.
- Persist workspace metadata as project-level workspace (not repo-scoped).

### `workspaces merge`

- Require clean working trees in all linked repos.
- Squash-merge workspace branch into the current branch for every repo.
- If any repo conflicts, abort merge in all repos and report conflict details per repo.

### `workspaces delete`

- Soft-delete workspace metadata.
- Remove all per-repo worktrees and workspace branches.
- Remove workspace root directory.

### `workspaces list`

- Show a single row per logical workspace.
- Include repo count and optionally per-repo health/status summary.

---

## Proposed Schema Direction

This is intentionally provisional and should be decided with implementation:

- Keep `workspace_shorthand` as canonical identifier.
- Treat `branch` and `worktree_path` as derived values or migrate to structured per-repo storage.
- Keep planner-owned ticket-to-workspace relation metadata; do not reintroduce
  core `ticket_workspaces`.
- Consider a workspace-repos table if per-repo lifecycle state is needed.

---

## Non-Goals For This Draft

- No command/flag guarantees.
- No migration plan guarantees.
- No rollout order guarantees.

This file exists only to isolate multi-repo planning from the implementation-aligned PRD.
