---
layout: ../../../../layouts/docs-layout.astro
title: pstdio workspaces
description: Reference for the pstdio workspaces command group.
htmlTitle: pstdio workspaces CLI
htmlDescription: Create, list, set status on, merge, and delete Prompt Studio workspaces from the CLI.
section: References
category: CLI
categoryOrder: 1
order: 5
---

## pstdio workspaces create

Create a workspace for a ticket.

**Options:**

- `--id <shorthand>` (required) — ticket shorthand, e.g. `PS-12`.
- `--base <ref>` — base branch/ref. Defaults to `HEAD`.
- `--branch <name>` — branch name when linking an existing worktree.
- `--worktree-path <path>` — existing worktree path to link instead of creating a new one.
- `--target worktree` — only `worktree` is supported.

**SDK equivalent:** `client.workspaces.create(input)` → `POST /v1/workspaces`.

## pstdio workspaces list

List active workspaces.

No options.

**SDK equivalent:** `client.workspaces.list(projectId)` → `GET /v1/workspaces`.

## pstdio workspaces list-statuses

List available attempt statuses.

**Options:**

- `--project-id <id>`.
- `--json` — machine-readable output.

**SDK equivalent:** `client.statuses.listAttemptStatuses(projectId)`.

## pstdio workspaces set-status

Update the attempt status for a workspace.

**Options:**

- `--workspace <shorthand>` — workspace shorthand (auto-detected from branch if omitted).
- `--status <name>` (required) — new attempt status.
- `--session-id <id>` — session id for deferred post-attempt-status hooks.

**SDK equivalent:** `client.workspaces.updateAttemptStatus(workspaceId, input)`.

## pstdio workspaces merge

Squash-merge workspace changes into the current branch.

**Options:**

- `--id <shorthand>` (required) — workspace shorthand, e.g. `PS-1_A1`.
- `--delete-workspace` — delete workspace after merge.

## pstdio workspaces delete

Force-remove a workspace.

**Options:**

- `--id <shorthand>` (required).

**SDK equivalent:** `client.workspaces.delete(workspaceId)`.

## Related pages

- [Workspaces and worktrees](/docs/concepts/workspaces-and-worktrees/).
- [Merge or clean up workspaces](/docs/workflows/merge-or-cleanup/).
- [`client.workspaces` reference](/docs/reference/sdk/client/#clientworkspaces).
