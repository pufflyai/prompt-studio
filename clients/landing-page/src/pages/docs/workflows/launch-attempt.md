---
layout: ../../../layouts/docs-layout.astro
title: Launch an agent attempt
description: Move a ticket into work-in-progress and start a session against a new worktree.
htmlTitle: Launch an agent attempt
htmlDescription: Move a ticket to work-in-progress and start an agent session — from the dashboard or two ways from the CLI.
section: Guide
category: Daily Workflow
categoryOrder: 3
order: 4
---

## From the dashboard (creates a worktree)

On the ticket detail page click **Implement** (top-right). A modal appears with the agent, model, and base branch; confirm to start. Prompt Studio:

1. Moves the ticket status to the project's WIP status.
2. Creates a workspace with mode `worktree`. A new branch (e.g. `pstdio/PS-42_A1`) is cut from the chosen base.
3. Starts a session against the worktree.

## From the CLI

The CLI gives you two paths. They are **not** equivalent.

### Shortcut against the repo root

```bash
pstdio tickets implement --id PS-42
```

This moves the ticket to `wip` and launches an agent session with the **current repo checkout** as its working directory. No workspace record, no worktree, no branch. Use it for quick runs when isolation doesn't matter.

### Worktree-backed attempt (matches the dashboard)

Create the workspace first, then start a session against it:

```bash
# 1. Create a worktree-backed workspace on a fresh branch.
pstdio workspaces create --id PS-42 --base main

# 2. Create a session scoped to that workspace.
pstdio sessions create \
  --workspace-id PS-42_A1 \
  --agent claude-code \
  --prompt "Implement the approach in the ticket."
```

`sessions create` also accepts `--template <name>` with `--var key=value` to use a prompt template.

## Pick the agent and model

- **Default agent** is set via `pstdio agents update <agent> --default`.
- Override per attempt with `--agent claude-code` or `--agent opencode`.
- Override the model with `--model <model-id>`. Available models come from `pstdio agents list` or `GET /v1/agents/{agent-id}/models`.

## Multiple attempts on the same ticket

Each new attempt increments the shorthand suffix: `PS-42_A1`, `PS-42_A2`, `PS-42_A3`. Use multiple attempts to:

- Try the same ticket with different agents or models.
- Re-run after reviewing feedback without losing the previous attempt.
- Run variations in parallel worktrees.

## Related pages

- [Workspaces and worktrees](/docs/concepts/workspaces-and-worktrees/) — what the attempt produces.
- [Follow up on a session](/docs/workflows/follow-up-session/) — continue a finished session.
- [`pstdio tickets implement`](/docs/reference/cli/tickets/#pstdio-tickets-implement) — CLI reference.
