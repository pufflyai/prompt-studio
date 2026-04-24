---
layout: ../../../layouts/docs-layout.astro
title: Workspaces and worktrees
description: Understand how Prompt Studio isolates agent attempts using git worktrees.
htmlTitle: Workspaces and git worktrees
htmlDescription: How Prompt Studio isolates each agent attempt with its own git worktree and branch, and where they live on disk.
section: Guide
category: Core Concepts
categoryOrder: 2
order: 3
---

## Attempts are workspaces

When you ask Prompt Studio to implement a ticket, it creates a **workspace**. A workspace is an attempt at the ticket:

- **`id`** — UUID.
- **`shorthand`** — like `PS-1_A1`. The suffix increases per attempt of the same ticket.
- **`ticket_id`** — the ticket the workspace is for.
- **`repo_id`** — the repo used for the attempt.
- **`branch`** — the new branch created for the attempt.
- **`base`** — the base ref the branch was cut from.
- **`worktree_path`** — absolute path to the git worktree on disk.
- **`attempt_status`** — workflow state of the attempt (e.g. `wip`, `review-ready`, `reviewed`).

## Worktree mode

The default workspace target is `worktree`. Prompt Studio:

1. Creates a fresh git worktree under your configured workspaces directory.
2. Creates a new branch (e.g. `pstdio/PS-1_A1`) from the chosen base.
3. Runs pre- and post-worktree-create hooks (see [Hook reference](/docs/reference/sdk/hooks/)).
4. Starts a session against the new worktree.

Link an existing worktree instead of creating a new one:

```bash
pstdio workspaces create --id PS-1 --worktree-path /abs/path/to/worktree --branch feature/foo
```

## Attempt status vs ticket status

Ticket status and attempt status are two different dimensions:

- **Ticket status** captures the work as a whole ("backlog" → "ready" → "wip" → "review-ready").
- **Attempt status** captures the state of a specific attempt (`wip` → `review-ready` → `reviewed`, or `changes-requested` / `blocked` when things stall).

Update attempt status from the dashboard, the CLI (`pstdio workspaces set-status`), or the SDK. Use `pstdio tickets update-when-attempt-status` to roll up attempt status to the ticket when all attempts agree.

## Cleanup

When you are done with an attempt:

- `pstdio workspaces merge --id PS-1_A1` — squash merge and optionally delete the workspace.
- `pstdio workspaces delete --id PS-1_A1` — drop the workspace and its worktree.
- `pstdio tickets worktrees remove-all --id PS-1` — remove every worktree associated with a ticket.

The pre-worktree-remove and post-worktree-remove hooks can prevent or react to the cleanup.

## Where worktrees live

Workspaces live under the directory set by `PSTDIO_WORKSPACES_DIR` (default: `$HOME/.pstdio/workspaces`). Each workspace gets its own subfolder. This keeps attempt worktrees out of your source repo.

## Related pages

- [Launch an agent attempt](/docs/workflows/launch-attempt/) — hands-on flow.
- [Merge or clean up workspaces](/docs/workflows/merge-or-cleanup/) — end of a workspace's life.
- [`pstdio workspaces` reference](/docs/reference/cli/workspaces/) — CLI commands.
